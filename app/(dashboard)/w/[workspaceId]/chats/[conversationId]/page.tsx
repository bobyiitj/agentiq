import { notFound } from "next/navigation";
import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { getWorkspaceModels } from "@/features/providers/queries";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/features/auth/auth-config";
import { ChatLayout } from "@/components/chat/chat-layout";
import type { Msg } from "@/components/chat/chat-runner";

export const runtime = "nodejs";

export default async function ConversationPage({
  params,
}: {
  params: { workspaceId: string; conversationId: string };
}) {
  await requireWorkspaceMembership(params.workspaceId);
  const accounts = await getWorkspaceModels(params.workspaceId);
  const session = await auth();

  const [conversation, dbMessages, conversations] = await Promise.all([
    prisma.conversation.findFirst({
      where: { id: params.conversationId, workspaceId: params.workspaceId },
      include: {
        agent: { select: { name: true, systemPrompt: true } },
        provider: { include: { provider: { select: { displayName: true } } } },
        model: { select: { displayName: true } },
      },
    }),
    prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { workspaceId: params.workspaceId, createdById: session!.user!.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        agent: { select: { name: true } },
        provider: { include: { provider: { select: { displayName: true } } } },
        model: { select: { displayName: true } },
        _count: { select: { messages: true } },
      },
    }),
  ]);

  if (!conversation) notFound();

  const messages: Msg[] = dbMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    timestamp: m.createdAt.getTime(),
    tag: (m.metadata as any)?.tag,
  }));

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
      activeConversationId={params.conversationId}
      initialMessages={messages}
      agentId={conversation.agentId ?? undefined}
      agentName={conversation.agent?.name ?? undefined}
      agentSystemPrompt={conversation.agent?.systemPrompt ?? undefined}
    />
  );
}
