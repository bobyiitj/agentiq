import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { streamAgentRun } from "@/features/agents/runner";
import { getClientMeta, logActivity } from "@/features/audit/logger";
import { sanitizeError } from "@/lib/security/sanitize";
import { rateLimitOrReject, RATE_LIMIT_CHAT } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(100000),
});

const chatSchema = z.object({
  workspaceId: z.string().min(1),
  messages: z.array(chatMessageSchema).min(1).max(100),
  providerAccountId: z.string().optional(),
  modelId: z.string().optional(),
  agentId: z.string().optional(),
  conversationId: z.string().optional(),
});

function generateTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed;
}

export async function POST(req: Request) {
  const rl = rateLimitOrReject(req, RATE_LIMIT_CHAT, "chat");
  if (rl) return rl;

  const session = await auth();
  const user = session?.user;
  const userId = user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid request";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { workspaceId, messages, providerAccountId, modelId, agentId, conversationId } = parsed.data;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Resolve or create conversation
  let convoId = conversationId;
  let isNewConversation = false;
  if (!convoId) {
    const firstUserMsg = messages.find((m) => m.role === "user");
    const newConvo = await prisma.conversation.create({
      data: {
        workspaceId,
        agentId: agentId ?? null,
        providerId: providerAccountId ?? null,
        modelId: modelId ?? null,
        createdById: userId,
        title: firstUserMsg ? generateTitle(firstUserMsg.content) : "New Chat",
        lastMessageAt: new Date(),
      },
    });
    convoId = newConvo.id;
    isNewConversation = true;
  } else {
    // Verify conversation belongs to this workspace
    const existing = await prisma.conversation.findFirst({
      where: { id: convoId, workspaceId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Save the latest user message to DB (only if the last user msg in array isn't already saved)
  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  if (lastUserMsg) {
    const msgCount = await prisma.message.count({ where: { conversationId: convoId } });
    if (msgCount === 0 || isNewConversation || msgCount < messages.length) {
      // ponytail: naive dedup — check if last message in DB matches to avoid saving on retry
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      let assistantRunId: string | null = null;
      let totalTokens = 0;

      try {
        const gen = streamAgentRun(
          {
            workspaceId,
            agentId,
            conversationId: convoId,
            triggerType: "CHAT",
            userId,
            messages,
            providerAccountId,
            modelId,
          }
        );
        for await (const ev of gen) {
          if (ev.type === "done" && ev.runId) {
            assistantRunId = ev.runId;
            if (ev.usage) totalTokens = ev.usage.totalTokens;
          }
          send(ev);
        }

        // After streaming: extract assistant content from the run output and save as message
        if (assistantRunId) {
          const run = await prisma.run.findUnique({
            where: { id: assistantRunId },
            select: { output: true, totalTokens: true, estimatedCost: true, modelId: true, providerAccountId: true },
          });
          const content = (run?.output as any)?.content ?? "";
          if (content) {
            await prisma.message.create({
              data: {
                conversationId: convoId,
                role: "ASSISTANT",
                content,
                tokens: run?.totalTokens ?? null,
                cost: run?.estimatedCost ?? null,
                metadata: { runId: assistantRunId, modelId: run?.modelId },
              },
            });
            const newCount = await prisma.message.count({ where: { conversationId: convoId } });
            await prisma.conversation.update({
              where: { id: convoId },
              data: {
                messageCount: newCount,
                totalTokens: { increment: totalTokens },
                estimatedCost: { increment: run?.estimatedCost ?? 0 },
                lastMessageAt: new Date(),
                providerId: run?.providerAccountId ?? providerAccountId ?? null,
                modelId: run?.modelId ?? modelId ?? null,
              },
            });
          }
        }
      } catch (err: any) {
        console.error("[chat]", err);
        send({ type: "error", error: sanitizeError(err) });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  const meta = getClientMeta(req);
  await logActivity({
    workspaceId,
    userId,
    action: "chat.message",
    resource: "conversation",
    resourceId: convoId,
    ...meta,
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Conversation-Id": convoId,
    },
  });
}
