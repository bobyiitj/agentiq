import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { getWorkspaceModels } from "@/features/providers/queries";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/features/auth/auth-config";
import { ChatLayout } from "@/components/chat/chat-layout";

export const runtime = "nodejs";

export default async function NewChatPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const accounts = await getWorkspaceModels(params.workspaceId);
  const session = await auth();

  const conversations = await prisma.conversation.findMany({
    where: { workspaceId: params.workspaceId, createdById: session!.user!.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      agent: { select: { name: true } },
      provider: { include: { provider: { select: { displayName: true } } } },
      model: { select: { displayName: true } },
      _count: { select: { messages: true } },
    },
  });

  return (
    <ChatLayout
      workspaceId={params.workspaceId}
      accounts={accounts}
      conversations={conversations.map((c) => ({
        ...c,
        agentName: c.agent?.name ?? null,
        providerName: c.provider?.provider.displayName ?? null,
        modelName: c.model?.displayName ?? null,
      }))}
    />
  );
}
