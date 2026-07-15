import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function WorkflowsPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  return (
    <ComingSoon
      title="Workflows"
      description="Multi-step agent orchestration with manual, scheduled, and webhook triggers, retries, and approval steps. The engine design is in place; the visual builder ships in Phase 2."
    />
  );
}
