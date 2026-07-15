import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { logActivity, getClientMeta } from "@/features/audit/logger";
import { z } from "zod";

const agentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  systemPrompt: z.string().min(1),
  defaultProviderAccountId: z.string().optional().nullable(),
  defaultModelId: z.string().optional().nullable(),
  config: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(1).max(32000).optional(),
      topP: z.number().min(0).max(1).optional(),
    })
    .optional()
    .default({}),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
});

export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const agents = await prisma.agent.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { runs: true } }, defaultModel: true },
  });
  return NextResponse.json(agents);
}

export async function POST(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "agents", "create"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const first = Object.values(errors)[0]?.[0] ?? "Invalid input";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const agent = await prisma.agent.create({
    data: {
      workspaceId: params.workspaceId,
      createdById: session.user.id,
      ...parsed.data,
    },
  });

  const meta = getClientMeta(req);
  await logActivity({
    workspaceId: params.workspaceId,
    userId: session.user.id,
    action: "agent.created",
    resource: "agent",
    resourceId: agent.id,
    metadata: { name: agent.name },
    ...meta,
  });

  return NextResponse.json(agent, { status: 201 });
}
