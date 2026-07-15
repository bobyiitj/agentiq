import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.number().optional(),
  tag: z.string().optional(),
});

export async function POST(
  req: Request,
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
  });
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid request";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { role, content, timestamp, tag } = parsed.data;

  await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      role: role === "user" ? "USER" : "ASSISTANT",
      content,
      metadata: tag ? { tag } : undefined,
      createdAt: timestamp ? new Date(timestamp) : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: new Date(), messageCount: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}

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

  const messages = await prisma.message.findMany({
    where: { conversationId: params.conversationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}
