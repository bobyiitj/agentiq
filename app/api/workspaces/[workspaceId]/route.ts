import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { logActivity, getClientMeta } from "@/features/audit/logger";

export async function GET(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ws = await prisma.workspace.findUnique({ where: { id: params.workspaceId } });
  return NextResponse.json(ws);
}

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120).optional(),
  description: z.string().max(2000).optional(),
});

export async function PATCH(req: Request, { params }: { params: { workspaceId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member || !can(member.role, "workspace", "update"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const first = Object.values(errors)[0]?.[0] ?? "Invalid input";
    return NextResponse.json({ error: first }, { status: 400 });
  }

  const ws = await prisma.workspace.update({
    where: { id: params.workspaceId },
    data: { name: parsed.data.name, description: parsed.data.description ?? null },
  });
  const meta = getClientMeta(req);
  await logActivity({ workspaceId: params.workspaceId, userId: session.user.id, action: "workspace.updated", resource: "workspace", resourceId: ws.id, ...meta });
  return NextResponse.json(ws);
}
