import Link from "next/link";
import { Plus, Bot } from "lucide-react";
import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

export default async function AgentsPage({ params }: { params: { workspaceId: string } }) {
  const ctx = await requireWorkspaceMembership(params.workspaceId);
  const agents = await prisma.agent.findMany({
    where: { workspaceId: params.workspaceId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { runs: true } }, defaultModel: true },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground">{agents.length} active agents</p>
        </div>
        {can(ctx.role, "agents", "create") && (
          <Link href={`/w/${params.workspaceId}/agents/new`}>
            <Button><Plus className="h-4 w-4" /> New Agent</Button>
          </Link>
        )}
      </div>

      {agents.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Bot className="mb-3 h-10 w-10 opacity-40" />
          <p className="font-medium">No agents yet</p>
          <Link href={`/w/${params.workspaceId}/agents/new`} className="mt-2 text-sm text-primary hover:underline">Create your first agent</Link>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/w/${params.workspaceId}/agents/${agent.id}`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><Bot className="h-4 w-4" /></div>
                      <div>
                        <p className="font-medium leading-tight">{agent.name}</p>
                        <p className="text-xs text-muted-foreground">{agent.defaultModel?.modelId ?? "No model"}</p>
                      </div>
                    </div>
                    <Badge variant={agent.status === "ACTIVE" ? "success" : "secondary"}>{agent.status}</Badge>
                  </div>
                  {agent.description && <p className="line-clamp-2 text-sm text-muted-foreground">{agent.description}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{agent._count.runs} runs</span>
                    <span>{formatRelativeTime(agent.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
