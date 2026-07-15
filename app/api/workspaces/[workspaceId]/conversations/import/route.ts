import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const importMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string().optional(),
  tokens: z.number().optional(),
  cost: z.number().optional(),
});

const importSchema = z.object({
  version: z.number(),
  conversation: z.object({
    title: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
  messages: z.array(importMessageSchema).min(1),
});

export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } }
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

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid import data";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const { conversation, messages } = parsed.data;

  const convo = await prisma.conversation.create({
    data: {
      workspaceId: params.workspaceId,
      createdById: session.user.id,
      title: conversation?.title ?? "Imported Chat",
      tags: conversation?.tags ?? [],
      lastMessageAt: new Date(),
      messageCount: messages.length,
      messages: {
        create: messages.map((m) => ({
          role: m.role === "user" ? "USER" : "ASSISTANT",
          content: m.content,
          createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
          tokens: m.tokens ?? null,
          cost: m.cost ?? null,
        })),
      },
    },
  });

  return NextResponse.json(convo, { status: 201 });
}
