import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceModels } from "@/features/providers/queries";
import { AgentForm } from "@/components/agents/agent-form";

export default async function EditAgentPage({ params }: { params: { workspaceId: string; agentId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const [agent, accounts] = await Promise.all([
    prisma.agent.findUniqueOrThrow({ where: { id: params.agentId } }),
    getWorkspaceModels(params.workspaceId),
  ]);
  return <AgentForm workspaceId={params.workspaceId} accounts={accounts} initial={agent} />;
}
