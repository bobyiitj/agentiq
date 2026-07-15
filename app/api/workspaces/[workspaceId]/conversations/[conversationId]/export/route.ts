import { NextResponse } from "next/server";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { workspaceId: string; conversationId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: params.workspaceId, userId: session.user.id } },
  });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, workspaceId: params.workspaceId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      agent: { select: { name: true } },
    },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (format === "markdown") {
    const lines = [
      `# ${conversation.title ?? "Chat"}`,
      "",
      `*Exported from AgentOS on ${new Date().toISOString()}*`,
      "",
      "---",
      "",
    ];

    for (const msg of conversation.messages) {
      const role = msg.role === "USER" ? "**You**" : `**${conversation.agent?.name ?? "Assistant"}**`;
      lines.push(`${role}:`);
      lines.push(msg.content);
      lines.push("");
    }

    const md = lines.join("\n");
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${conversation.title ?? "chat"}.md"`,
      },
    });
  }

  const json = {
    version: 1,
    exportedAt: new Date().toISOString(),
    conversation: {
      title: conversation.title,
      agentName: conversation.agent?.name,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      totalTokens: conversation.totalTokens,
      estimatedCost: conversation.estimatedCost,
      messageCount: conversation.messageCount,
      tags: conversation.tags,
    },
    messages: conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      tokens: m.tokens,
      cost: m.cost,
    })),
  };

  return new NextResponse(JSON.stringify(json, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${conversation.title ?? "chat"}.json"`,
    },
  });
}
