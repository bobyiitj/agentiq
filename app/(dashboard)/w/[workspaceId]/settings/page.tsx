import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { ProfileSettings } from "@/components/settings/profile-settings";

export default async function ProfilePage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: params.workspaceId } });
  return <ProfileSettings workspaceId={params.workspaceId} initial={ws} />;
}
