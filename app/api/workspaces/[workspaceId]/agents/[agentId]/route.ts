import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { logActivity, getClientMeta } from "@/features/audit/logger";

const agentUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(10000).optional(),
  defaultProviderAccountId: z.string().nullable().optional(),
  defaultModelId: z.string().nullable().optional(),
  config: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(1).max(128000).optional(),
      topP: z.number().min(0).max(1).optional(),
    })
    .optional(),
  status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { workspaceId: string; agentId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "agents", "update"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = agentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const first = Object.values(errors)[0]?.[0] ?? "Invalid input";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const agent = await prisma.agent.update({
    where: { id: params.agentId },
    data: parsed.data,
  });

  const meta = getClientMeta(req);
  await logActivity({
    workspaceId: params.workspaceId,
    userId: session.user.id,
    action: "agent.updated",
    resource: "agent",
    resourceId: agent.id,
    metadata: { name: agent.name },
    ...meta,
  });

  return NextResponse.json(agent);
}

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string; agentId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "agents", "delete"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.agent.update({
    where: { id: params.agentId },
    data: { status: "ARCHIVED" },
  });

  const meta = getClientMeta(req);
  await logActivity({
    workspaceId: params.workspaceId,
    userId: session.user.id,
    action: "agent.archived",
    resource: "agent",
    resourceId: params.agentId,
    ...meta,
  });

  return NextResponse.json({ ok: true });
}
