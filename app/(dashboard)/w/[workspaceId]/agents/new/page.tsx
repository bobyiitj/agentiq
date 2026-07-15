import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { getWorkspaceModels } from "@/features/providers/queries";
import { AgentForm } from "@/components/agents/agent-form";

export default async function NewAgentPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const accounts = await getWorkspaceModels(params.workspaceId);
  return <AgentForm workspaceId={params.workspaceId} accounts={accounts} />;
}
