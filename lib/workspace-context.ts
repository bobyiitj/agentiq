import { cookies } from "next/headers";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export const ACTIVE_WS_COOKIE = "agentos_active_ws";

// Resolves the active workspace for the current user.
// `fromParam` = workspaceId from the URL (route segment). Falls back to cookie,
// then to the user's first workspace. Redirects to / if none.
export async function resolveActiveWorkspace(fromParam?: string): Promise<{
  workspace: any;
  role: string;
  isDefault: boolean;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) return null;

  const cookieWs = cookies().get(ACTIVE_WS_COOKIE)?.value;
  const targetId = fromParam || cookieWs;
  let chosen = memberships.find((m) => m.workspaceId === targetId);
  if (!chosen) chosen = memberships[0];

  return {
    workspace: chosen.workspace,
    role: chosen.role,
    isDefault: chosen.workspaceId === memberships[0].workspaceId,
  };
}

export async function requireActiveWorkspace(fromParam?: string) {
  const result = await resolveActiveWorkspace(fromParam);
  if (!result) redirect("/");
  return result!;
}
