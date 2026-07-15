import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { can, type Action, type Resource } from "./rbac";
import type { MemberRole } from "@prisma/client";

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

export interface WorkspaceContext {
  workspaceId: string;
  role: MemberRole;
  userId: string;
}

// Resolves the current user's membership (and thus role) for a workspace.
// Throws if not a member. Returns context used by downstream guards.
export async function requireWorkspaceMembership(workspaceId: string): Promise<WorkspaceContext> {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Not authenticated");

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!member) throw new ForbiddenError("Not a member of this workspace");

  return { workspaceId, role: member.role, userId: session.user.id };
}

export async function requirePermission(
  workspaceId: string,
  resource: Resource,
  action: Action
): Promise<WorkspaceContext> {
  const ctx = await requireWorkspaceMembership(workspaceId);
  if (!can(ctx.role, resource, action)) {
    throw new ForbiddenError(`Role ${ctx.role} cannot ${action} ${resource}`);
  }
  return ctx;
}

// For routes keyed by [workspaceId] — call in server components / route handlers.
export async function getWorkspaceContext(
  workspaceId: string
): Promise<WorkspaceContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.user.id } },
  });
  if (!member) return null;
  return { workspaceId, role: member.role, userId: session.user.id };
}
