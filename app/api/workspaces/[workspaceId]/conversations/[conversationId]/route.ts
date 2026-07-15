import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string; conversationId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const convo = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: params.workspaceId },
    include: {
      agent: { select: { name: true } },
      provider: { include: { provider: { select: { displayName: true } } } },
      model: { select: { displayName: true } },
    },
  });
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.message.findMany({
    where: { conversationId: params.conversationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, metadata: true, createdAt: true, tokens: true, cost: true },
  });

  return NextResponse.json({
    ...convo,
    agentName: convo.agent?.name,
    providerName: convo.provider?.provider.displayName,
    modelName: convo.model?.displayName,
    messages,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { workspaceId: string; conversationId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid request";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const updated = await prisma.conversation.updateMany({
    where: { id: params.conversationId, workspaceId: params.workspaceId },
    data: parsed.data,
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { workspaceId: string; conversationId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const deleted = await prisma.conversation.deleteMany({
    where: { id: params.conversationId, workspaceId: params.workspaceId },
  });
  if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
