import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { MembersSettings } from "@/components/settings/members-settings";

export default async function MembersPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const [members, invitations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: params.workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { workspaceId: params.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  return <MembersSettings workspaceId={params.workspaceId} initialMembers={members} initialInvitations={invitations} />;
}
