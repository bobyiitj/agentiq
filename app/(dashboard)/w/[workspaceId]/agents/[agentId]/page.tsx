import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot, Pencil, Play, Trash2 } from "lucide-react";
import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { getWorkspaceModels } from "@/features/providers/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChatRunner } from "@/components/chat/chat-runner";
import { formatRelativeTime } from "@/lib/utils";
import { DeleteAgentButton } from "@/components/agents/delete-button";

export default async function AgentDetailPage({ params }: { params: { workspaceId: string; agentId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const agent = await prisma.agent.findUnique({
    where: { id: params.agentId },
    include: { defaultModel: true, defaultProviderAccount: true, _count: { select: { runs: true } } },
  });
  if (!agent) notFound();

  const [recentRuns, accounts] = await Promise.all([
    prisma.run.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { model: true },
    }),
    getWorkspaceModels(params.workspaceId),
  ]);

  const cfg = (agent.config as any) ?? {};

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col border-r">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Link href={`/w/${params.workspaceId}/agents`} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
            <Bot className="h-5 w-5" />
            <h1 className="font-semibold">{agent.name}</h1>
            <Badge variant={agent.status === "ACTIVE" ? "success" : "secondary"}>{agent.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Link href={`/w/${params.workspaceId}/agents/${agent.id}/edit`}>
              <Button size="sm" variant="outline"><Pencil className="h-4 w-4" /> Edit</Button>
            </Link>
            <DeleteAgentButton workspaceId={params.workspaceId} agentId={agent.id} />
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatRunner
            workspaceId={params.workspaceId}
            accounts={accounts}
            agentId={agent.id}
            agentName={agent.name}
            agentSystemPrompt={agent.systemPrompt}
          />
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto p-4 scrollbar-thin">
        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Model" value={agent.defaultModel?.modelId ?? "—"} />
            <Row label="Provider" value={agent.defaultProviderAccount?.label ?? "—"} />
            <Row label="Temperature" value={String(cfg.temperature ?? 0.7)} />
            <Row label="Max Tokens" value={String(cfg.maxTokens ?? 1024)} />
            <Row label="Top P" value={String(cfg.topP ?? 1)} />
            <Row label="Total Runs" value={String(agent._count.runs)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">System Prompt</CardTitle></CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs scrollbar-thin">{agent.systemPrompt}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Runs</CardTitle>
            <Link href={`/w/${params.workspaceId}/runs?agentId=${agent.id}`} className="text-xs text-primary hover:underline">All</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRuns.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
            {recentRuns.map((run) => (
              <Link key={run.id} href={`/w/${params.workspaceId}/runs/${run.id}`} className="block rounded-md border p-2 text-sm hover:bg-accent/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(run.createdAt)}</span>
                  <Badge variant={run.status === "COMPLETED" ? "success" : run.status === "FAILED" ? "destructive" : "info"}>{run.status}</Badge>
                </div>
                <p className="mt-1 truncate text-xs">{(run.output as any)?.content?.slice(0, 80) ?? "—"}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
