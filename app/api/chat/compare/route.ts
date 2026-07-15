import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { streamAgentRun } from "@/features/agents/runner";
import { sanitizeError } from "@/lib/security/sanitize";
import { rateLimitOrReject, RATE_LIMIT_CHAT } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const targetSchema = z.object({
  providerAccountId: z.string().min(1),
  modelId: z.string().min(1),
  tag: z.string().max(50).optional(),
});

const compareSchema = z.object({
  workspaceId: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["user", "assistant", "system"]), content: z.string().max(100000) })).min(1).max(100),
  targets: z.array(targetSchema).min(1).max(5),
});

export async function POST(req: Request) {
  const rl = rateLimitOrReject(req, RATE_LIMIT_CHAT, "chat-compare");
  if (rl) return rl;

  const session = await auth();
  const user = session?.user;
  const userId = user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = compareSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid request";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { workspaceId, messages, targets } = parsed.data;

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const runners = targets.map((t) => {
        const tag = t.tag ?? t.modelId;
        const gen = streamAgentRun(
          {
            workspaceId,
            triggerType: "MANUAL",
            userId,
            messages,
            providerAccountId: t.providerAccountId,
            modelId: t.modelId,
            agentName: tag,
          }
        );
        return { tag, gen };
      });

      try {
        await Promise.all(
          runners.map(async ({ gen, tag }) => {
            for await (const ev of gen) send({ ...ev, tag });
          })
        );
      } catch (err: any) {
        console.error("[chat-compare]", err);
        send({ type: "error", error: sanitizeError(err) });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
