import { prisma } from "@/lib/db/prisma";
import { decryptJSON } from "@/lib/providers/encryption";
import { createAdapter } from "@/lib/providers/registry";
import type { ChatMessage, StreamEvent } from "@/lib/providers/types";
import { calculateCost } from "@/lib/ai/cost";
import { logActivity } from "@/features/audit/logger";
import type { Agent, Model, WorkspaceProviderAccount } from "@prisma/client";

export interface RunAgentInput {
  workspaceId: string;
  agentId?: string;
  conversationId?: string;
  triggerType: "MANUAL" | "CHAT" | "WORKFLOW" | "API";
  userId: string;
  systemPrompt?: string;
  modelId?: string;
  providerAccountId?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  agentName?: string;
}

interface LoadedContext {
  providerAccount: WorkspaceProviderAccount & { provider: { name: string } };
  model: Model;
  agent?: any;
}

async function loadContext(input: RunAgentInput): Promise<LoadedContext> {
  let providerAccount: any = null;
  let model: any = null;
  let agent;

   if (input.agentId) {
    agent = await prisma.agent.findUnique({
      where: { id: input.agentId },
      include: { defaultProviderAccount: { include: { provider: true } }, defaultModel: true },
    });
    if (!agent) throw new Error("Agent not found");
    providerAccount = agent.defaultProviderAccount;
    model = agent.defaultModel;
  }

  if (!providerAccount && input.providerAccountId) {
    providerAccount = await prisma.workspaceProviderAccount.findUnique({
      where: { id: input.providerAccountId },
      include: { provider: true },
    });
  }
  if (!model && input.modelId) {
    model = await prisma.model.findUnique({ where: { id: input.modelId } });
  }
  if (!providerAccount || !model) throw new Error("Provider account or model not resolved");

  return { providerAccount, model, agent };
}

export interface RunAgentResult {
  runId: string;
  content: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// Executes an agent run, streaming events to `onEvent` (for live UI) and
// persisting Run / RunStep / UsageRecord at completion.
export async function* streamAgentRun(
  input: RunAgentInput,
  onEvent?: (e: StreamEvent) => void
): AsyncGenerator<StreamEvent> {
  const ctx = await loadContext(input);

  const run = await prisma.run.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      conversationId: input.conversationId,
      triggerType: input.triggerType,
      status: "STREAMING",
      input: { messages: input.messages } as object,
      providerAccountId: ctx.providerAccount.id,
      modelId: ctx.model.id,
      startedAt: new Date(),
      createdById: input.userId,
    },
  });

  await prisma.runStep.create({
    data: {
      runId: run.id,
      stepNumber: 1,
      type: "AGENT",
      name: input.agentName ?? ctx.model.modelId,
      status: "RUNNING",
      input: { messages: input.messages } as object,
      providerAccountId: ctx.providerAccount.id,
      modelId: ctx.model.id,
    },
  });

  let fullContent = "";
  let finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const adapter = createAdapter(ctx.providerAccount.provider.name, {
    apiKey: decryptJSON<{ apiKey: string }>(ctx.providerAccount.encryptedCredentials).apiKey,
    baseUrl: ctx.providerAccount.baseUrlOverride ?? undefined,
  });

  try {
    for await (const event of adapter.chatStream({
      messages: input.messages,
      model: ctx.model.modelId,
      temperature: input.temperature ?? (ctx.agent?.config as any)?.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? (ctx.agent?.config as any)?.maxTokens,
      topP: input.topP ?? (ctx.agent?.config as any)?.topP,
      stream: true,
    })) {
      onEvent?.(event);
      yield event;
      if (event.type === "token") {
        fullContent += event.content;
      } else if (event.type === "done" && event.usage) {
        finalUsage = event.usage;
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    }

    const cost = calculateCost({
      inputCostPer1k: ctx.model.inputCostPer1kTokens,
      outputCostPer1k: ctx.model.outputCostPer1kTokens,
      promptTokens: finalUsage.promptTokens,
      completionTokens: finalUsage.completionTokens,
    });

    await prisma.$transaction([
      prisma.run.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          output: { content: fullContent } as object,
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
          estimatedCost: cost.total,
          durationMs: Date.now() - run.startedAt!.getTime(),
          completedAt: new Date(),
        },
      }),
      prisma.runStep.updateMany({
        where: { runId: run.id, stepNumber: 1 },
        data: {
          status: "COMPLETED",
          output: { content: fullContent } as object,
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
          estimatedCost: cost.total,
          completedAt: new Date(),
          durationMs: Date.now() - run.startedAt!.getTime(),
        },
      }),
      prisma.usageRecord.create({
        data: {
          workspaceId: input.workspaceId,
          providerAccountId: ctx.providerAccount.id,
          modelId: ctx.model.id,
          agentId: input.agentId,
          runId: run.id,
          operation: "completion",
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
          inputCost: cost.input,
          outputCost: cost.output,
          totalCost: cost.total,
        },
      }),
    ]);

    await logActivity({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "run.completed",
      resource: "run",
      resourceId: run.id,
      metadata: { agentId: input.agentId, model: ctx.model.modelId, tokens: finalUsage.totalTokens },
    });

    yield { type: "done", usage: finalUsage, runId: run.id };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "run failed";
    console.error("[runner]", raw, err);
    // Store sanitized message in DB — never internal details
    const safeMsg = /certificate|ECONNREFUSED|ENOTFOUND|localhost|127\.|192\.168|10\.\d/i.test(raw)
      ? "Provider connection failed. Check your provider settings."
      : raw.length > 200
        ? raw.slice(0, 200) + "…"
        : raw;
    await prisma.$transaction([
      prisma.run.update({
        where: { id: run.id },
        data: { status: "FAILED", error: safeMsg, completedAt: new Date() },
      }),
      prisma.runStep.updateMany({
        where: { runId: run.id, stepNumber: 1 },
        data: { status: "FAILED", error: safeMsg, completedAt: new Date() },
      }),
    ]);
    yield { type: "error", error: safeMsg };
  }
}

// Non-streaming variant: drains the generator and returns the run id.
export async function runAgent(
  input: RunAgentInput,
  conversationId?: string
): Promise<{ runId: string; conversationId?: string }> {
  let convoId = conversationId;
  let isNewConversation = false;

  // Resolve or create conversation
  if (!convoId) {
    const firstUserMsg = input.messages.find((m) => m.role === "user");
    const newConvo = await prisma.conversation.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId ?? null,
        providerId: input.providerAccountId ?? null,
        modelId: input.modelId ?? null,
        createdById: input.userId,
        title: firstUserMsg ? generateTitle(firstUserMsg.content) : "New Chat",
        lastMessageAt: new Date(),
      },
    });
    convoId = newConvo.id;
    isNewConversation = true;
  }

  // Save the latest user message to DB
  const lastUserMsg = input.messages.filter((m) => m.role === "user").pop();
  if (lastUserMsg) {
    const msgCount = await prisma.message.count({ where: { conversationId: convoId } });
    if (msgCount === 0 || isNewConversation || msgCount < input.messages.length) {
      // Check if last message in DB matches to avoid saving on retry
      const lastDbMsg = await prisma.message.findFirst({
        where: { conversationId: convoId, role: "USER" },
        orderBy: { createdAt: "desc" },
      });
      if (lastDbMsg?.content !== lastUserMsg.content) {
        await prisma.message.create({
          data: { conversationId: convoId, role: "USER", content: lastUserMsg.content },
        });
        await prisma.conversation.update({
          where: { id: convoId },
          data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
        });
      }
    }
  }

  // Execute agent stream
  let fullContent = "";
  let finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let runId: string | null = null;

  const ctx = await loadContext(input);

  try {
    const run = await prisma.run.create({
      data: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        conversationId: convoId,
        triggerType: "CHAT",
        status: "STREAMING",
        input: { messages: input.messages } as object,
        providerAccountId: ctx.providerAccount.id,
        modelId: ctx.model.id,
        startedAt: new Date(),
        createdById: input.userId,
      },
    });
    runId = run.id;

    await prisma.runStep.create({
      data: {
        runId: run.id,
        stepNumber: 1,
        type: "AGENT",
        name: input.agentName ?? ctx.model.modelId,
        status: "RUNNING",
        input: { messages: input.messages } as object,
        providerAccountId: ctx.providerAccount.id,
        modelId: ctx.model.id,
      },
    });

    const adapter = createAdapter(ctx.providerAccount.provider.name, {
      apiKey: decryptJSON<{ apiKey: string }>(ctx.providerAccount.encryptedCredentials).apiKey,
      baseUrl: ctx.providerAccount.baseUrlOverride ?? undefined,
    });

    for await (const event of adapter.chatStream({
      messages: input.messages,
      model: ctx.model.modelId,
      temperature: input.temperature ?? (ctx.agent?.config as any)?.temperature ?? 0.7,
      maxTokens: input.maxTokens ?? (ctx.agent?.config as any)?.maxTokens,
      topP: input.topP ?? (ctx.agent?.config as any)?.topP,
      stream: true,
    })) {
      if (event.type === "token") {
        fullContent += event.content;
      } else if (event.type === "done" && event.usage) {
        finalUsage = event.usage;
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    }

    const cost = calculateCost({
      inputCostPer1k: ctx.model.inputCostPer1kTokens,
      outputCostPer1k: ctx.model.outputCostPer1kTokens,
      promptTokens: finalUsage.promptTokens,
      completionTokens: finalUsage.completionTokens,
    });

    await prisma.$transaction([
      prisma.run.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          output: { content: fullContent } as object,
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
          estimatedCost: cost.total,
          durationMs: Date.now() - run.startedAt!.getTime(),
          completedAt: new Date(),
        },
      }),
      prisma.runStep.updateMany({
        where: { runId, stepNumber: 1 },
        data: {
          status: "COMPLETED",
          output: { content: fullContent } as object,
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
          estimatedCost: cost.total,
          completedAt: new Date(),
          durationMs: Date.now() - run.startedAt!.getTime(),
        },
      }),
      prisma.usageRecord.create({
        data: {
          workspaceId: input.workspaceId,
          providerAccountId: ctx.providerAccount.id,
          modelId: ctx.model.id,
          agentId: input.agentId,
          runId: runId,
          operation: "completion",
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
          inputCost: cost.input,
          outputCost: cost.output,
          totalCost: cost.total,
        },
      }),
      prisma.message.create({
        data: {
          conversationId: convoId,
          role: "ASSISTANT",
          content: fullContent,
          tokens: finalUsage.totalTokens,
          cost: cost.total,
          metadata: { runId },
        },
      }),
      prisma.conversation.update({
        where: { id: convoId },
        data: {
          messageCount: { increment: 1 },
          totalTokens: { increment: finalUsage.totalTokens },
          estimatedCost: { increment: cost.total },
          lastMessageAt: new Date(),
          providerId: ctx.providerAccount.id,
          modelId: ctx.model.id,
        },
      }),
    ]);

    await logActivity({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "run.completed",
      resource: "run",
      resourceId: runId,
      metadata: { agentId: input.agentId, model: ctx.model.modelId, tokens: finalUsage.totalTokens },
    });

    return { runId, conversationId: convoId };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "run failed";
    console.error("[runner]", raw, err);
    const safeMsg = /certificate|ECONNREFUSED|ENOTFOUND|localhost|127\.|192\.168|10\.\d/i.test(raw)
      ? "Provider connection failed. Check your provider settings."
      : raw.length > 200
        ? raw.slice(0, 200) + "…"
        : raw;

    // Clean up the run on error
    if (runId) {
      await prisma.run.update({
        where: { id: runId },
        data: { status: "FAILED", error: safeMsg, completedAt: new Date() },
      });
      await prisma.runStep.updateMany({
        where: { runId, stepNumber: 1 },
        data: { status: "FAILED", error: safeMsg, completedAt: new Date() },
      });
    }

    throw err;
  }
}

function generateTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
}
