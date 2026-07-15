import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  await requireWorkspaceMembership(params.workspaceId);
  return (
    <div className="flex gap-8 p-6">
      <SettingsNav workspaceId={params.workspaceId} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
