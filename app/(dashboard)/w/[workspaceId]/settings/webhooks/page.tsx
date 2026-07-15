import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { ComingSoon } from "@/components/common/coming-soon";

export default async function WebhooksPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  return (
    <ComingSoon
      title="Webhooks"
      description="Outbound webhooks for run events, with HMAC signature verification and retry-with-backoff delivery logging."
    />
  );
}
