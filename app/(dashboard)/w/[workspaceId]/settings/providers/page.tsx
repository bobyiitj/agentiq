import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { ProvidersSettings } from "@/components/settings/providers-settings";

export default async function ProvidersSettingsPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  return <ProvidersSettings workspaceId={params.workspaceId} />;
}
