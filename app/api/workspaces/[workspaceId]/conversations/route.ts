import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().max(200).optional(),
  agentId: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  modelId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { workspaceId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "updated";
  const archived = searchParams.get("archived") === "true";
  const pinnedOnly = searchParams.get("pinned") === "true";
  const agentId = searchParams.get("agentId") ?? undefined;
  const providerId = searchParams.get("providerId") ?? undefined;
  const modelId = searchParams.get("modelId") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const after = searchParams.get("after") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const orderBy: Record<string, "asc" | "desc"> =
    sort === "oldest" ? { createdAt: "asc" }
    : sort === "alphabetical" ? { title: "asc" }
    : sort === "newest" ? { createdAt: "desc" }
    : { updatedAt: "desc" };

  const where: Record<string, unknown> = {
    workspaceId: params.workspaceId,
    isArchived: archived,
  };
  if (pinnedOnly) where.isPinned = true;
  if (agentId) where.agentId = agentId;
  if (providerId) where.providerId = providerId;
  if (modelId) where.modelId = modelId;
  if (tag) where.tags = { has: tag };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { messages: { some: { content: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (after) {
    where.id = { gt: after };
  }

  const conversations = await prisma.conversation.findMany({
    where,
    orderBy,
    take: limit,
    include: {
      agent: { select: { name: true } },
      provider: { include: { provider: { select: { displayName: true } } } },
      model: { select: { displayName: true } },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      ...c,
      agentName: c.agent?.name ?? null,
      providerName: c.provider?.provider.displayName ?? null,
      modelName: c.model?.displayName ?? null,
      _count: undefined,
      agent: undefined,
      provider: undefined,
      model: undefined,
    })),
    hasMore: conversations.length === limit,
    nextCursor: conversations.length === limit ? conversations[conversations.length - 1].id : null,
  });
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "Invalid request";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const convo = await prisma.conversation.create({
    data: {
      workspaceId: params.workspaceId,
      createdById: session.user.id,
      title: parsed.data.title ?? "New Chat",
      agentId: parsed.data.agentId ?? null,
      providerId: parsed.data.providerId ?? null,
      modelId: parsed.data.modelId ?? null,
      tags: parsed.data.tags ?? [],
    },
  });

  return NextResponse.json(convo, { status: 201 });
}
