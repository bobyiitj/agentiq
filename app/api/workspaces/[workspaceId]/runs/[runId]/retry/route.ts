import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { runAgent } from "@/features/agents/runner";
import type { ChatMessage } from "@/lib/providers/types";

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string; runId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "runs", "create"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const original = await prisma.run.findUnique({ where: { id: params.runId } });
  if (!original || original.workspaceId !== params.workspaceId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = ((original.input as any)?.messages ?? []) as ChatMessage[];
  const newRunId = await runAgent({
    workspaceId: params.workspaceId,
    agentId: original.agentId ?? undefined,
    conversationId: original.conversationId ?? undefined,
    triggerType: "MANUAL",
    userId: session.user.id,
    messages,
    providerAccountId: original.providerAccountId ?? undefined,
    modelId: original.modelId ?? undefined,
  });

  return NextResponse.json({ runId: newRunId });
}
