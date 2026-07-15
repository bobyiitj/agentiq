import Link from "next/link";
import { Activity, AlertTriangle, Bot, DollarSign, Zap, Plus, ArrowRight, Clock, Cpu } from "lucide-react";
import { auth } from "@/features/auth/auth-config";
import { prisma } from "@/lib/db/prisma";
import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDuration, formatRelativeTime } from "@/lib/utils";

export default async function OverviewPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const wsId = params.workspaceId;

  const [stats, activeRuns, failures, recentRuns, providerAccounts, agents] = await Promise.all([
    prisma.run.groupBy({
      by: ["status"],
      where: { workspaceId: wsId },
      _count: { id: true },
    }),
    prisma.run.count({ where: { workspaceId: wsId, status: { in: ["RUNNING", "STREAMING", "QUEUED"] } } }),
    prisma.run.count({ where: { workspaceId: wsId, status: "FAILED" } }),
    prisma.run.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { agent: true, model: true },
    }),
    prisma.workspaceProviderAccount.findMany({
      where: { workspaceId: wsId },
      include: { provider: true },
    }),
    prisma.agent.count({ where: { workspaceId: wsId, status: "ACTIVE" } }),
  ]);

  const costAgg = await prisma.usageRecord.aggregate({
    where: { workspaceId: wsId },
    _sum: { totalCost: true, totalTokens: true },
  });

  const todayCost = await prisma.usageRecord.aggregate({
    where: { workspaceId: wsId, recordedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    _sum: { totalCost: true },
  });

  const totalRuns = await prisma.run.count({ where: { workspaceId: wsId } });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">Real-time control tower for your AI operations.</p>
        </div>
        <Link href={`/w/${wsId}/chats/new`}>
          <Button className="gap-2 shadow-md shadow-primary/20">
            <Zap className="h-4 w-4" /> New Run
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cost (24h)" value={formatCurrency(todayCost._sum.totalCost ?? 0)} icon={DollarSign} tone="info" />
        <StatCard label="Active Runs" value={String(activeRuns)} icon={Activity} tone="success" />
        <StatCard label="Failures" value={String(failures)} icon={AlertTriangle} tone={failures > 0 ? "destructive" : "default"} />
        <StatCard label="Total Spend" value={formatCurrency(costAgg._sum.totalCost ?? 0)} icon={DollarSign} hint={`${(costAgg._sum.totalTokens ?? 0).toLocaleString()} tokens`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Runs</CardTitle>
            <Link href={`/w/${wsId}/runs`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRuns.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Clock className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">No runs yet. Start a chat to see activity.</p>
              </div>
            )}
            {recentRuns.map((run) => (
              <Link key={run.id} href={`/w/${wsId}/runs/${run.id}`} className="flex items-center justify-between rounded-xl border border-border/50 p-3 text-sm transition-all hover:bg-accent/50 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{run.agent?.name ?? "Ad-hoc chat"}</p>
                  <p className="text-xs text-muted-foreground">{run.model?.modelId ?? "—"} · {formatRelativeTime(run.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(run.estimatedCost)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Providers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {providerAccounts.length === 0 && (
                <div className="flex flex-col items-center py-4 text-center text-muted-foreground">
                  <Cpu className="mb-2 h-6 w-6 opacity-40" />
                  <p className="text-sm">No providers connected.</p>
                  <Link href={`/w/${wsId}/settings/providers`} className="mt-1 text-sm text-primary hover:underline">Connect one</Link>
                </div>
              )}
              {providerAccounts.map((pa) => (
                <div key={pa.id} className="flex items-center justify-between rounded-xl border border-border/50 p-2.5 text-sm transition-colors hover:bg-accent/30">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${pa.isActive ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                    <span className="font-medium">{pa.label}</span>
                  </div>
                  <Badge variant={pa.isActive ? "success" : "secondary"}>{pa.isActive ? "active" : "off"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Link href={`/w/${wsId}/agents/new`}>
                <Button variant="outline" size="sm" className="w-full gap-1.5"><Bot className="h-3.5 w-3.5" /> Agent</Button>
              </Link>
              <Link href={`/w/${wsId}/chats/new`}>
                <Button variant="outline" size="sm" className="w-full gap-1.5"><Zap className="h-3.5 w-3.5" /> Run</Button>
              </Link>
              <Link href={`/w/${wsId}/workflows/new`}>
                <Button variant="outline" size="sm" className="w-full gap-1.5"><Plus className="h-3.5 w-3.5" /> Workflow</Button>
              </Link>
              <Link href={`/w/${wsId}/usage`}>
                <Button variant="outline" size="sm" className="w-full gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Usage</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{agents} Active Agent{agents !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground">Ready to run</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
