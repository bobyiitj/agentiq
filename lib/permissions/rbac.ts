import type { MemberRole } from "@prisma/client";

// Role hierarchy: higher index = more privilege
const RANK: Record<MemberRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleRank(role: MemberRole): number {
  return RANK[role] ?? -1;
}

export function hasAtLeast(role: MemberRole, required: MemberRole): boolean {
  return roleRank(role) >= roleRank(required);
}

// Resource-level permission matrix
export type Resource =
  | "workspace"
  | "members"
  | "providers"
  | "agents"
  | "workflows"
  | "runs"
  | "usage"
  | "logs"
  | "settings";

export type Action = "view" | "create" | "update" | "delete" | "manage";

// Minimum role required for an action on a resource.
const MATRIX: Record<Resource, Record<Action, MemberRole>> = {
  workspace: { view: "VIEWER", create: "OWNER", update: "ADMIN", delete: "OWNER", manage: "ADMIN" },
  members:   { view: "MEMBER", create: "ADMIN", update: "ADMIN", delete: "ADMIN", manage: "ADMIN" },
  providers: { view: "MEMBER", create: "ADMIN", update: "ADMIN", delete: "ADMIN", manage: "ADMIN" },
  agents:    { view: "MEMBER", create: "MEMBER", update: "MEMBER", delete: "MEMBER", manage: "ADMIN" },
  workflows: { view: "MEMBER", create: "MEMBER", update: "MEMBER", delete: "MEMBER", manage: "ADMIN" },
  runs:      { view: "VIEWER", create: "MEMBER", update: "MEMBER", delete: "MEMBER", manage: "ADMIN" },
  usage:     { view: "ADMIN", create: "ADMIN", update: "ADMIN", delete: "ADMIN", manage: "ADMIN" },
  logs:      { view: "ADMIN", create: "ADMIN", update: "ADMIN", delete: "ADMIN", manage: "ADMIN" },
  settings:  { view: "MEMBER", create: "ADMIN", update: "ADMIN", delete: "ADMIN", manage: "ADMIN" },
};

export function can(role: MemberRole, resource: Resource, action: Action): boolean {
  const required = MATRIX[resource][action];
  return hasAtLeast(role, required);
}
