import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { workspaceId: string; conversationId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const original = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: params.workspaceId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await prisma.conversation.create({
    data: {
      workspaceId: params.workspaceId,
      createdById: session.user.id,
      agentId: original.agentId,
      providerId: original.providerId,
      modelId: original.modelId,
      title: `${original.title ?? "Chat"} (copy)`,
      tags: original.tags,
      totalTokens: original.totalTokens,
      estimatedCost: original.estimatedCost,
      messageCount: original.messageCount,
      lastMessageAt: original.lastMessageAt,
      messages: {
        create: original.messages.map((m) => ({
          role: m.role,
          content: m.content,
          metadata: m.metadata as any,
          tokens: m.tokens,
          cost: m.cost,
        })),
      },
    },
  });

  return NextResponse.json(copy, { status: 201 });
}
