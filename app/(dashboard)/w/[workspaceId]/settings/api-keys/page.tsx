import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function ApiKeysPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  return (
    <ComingSoon
      title="API Keys"
      description="Scoped programmatic API keys for server-to-server access to the AgentOS execution and agent APIs."
    />
  );
}
