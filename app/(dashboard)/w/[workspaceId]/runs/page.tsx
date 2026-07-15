import Link from "next/link";
import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDuration, formatRelativeTime } from "@/lib/utils";
import { RunsToolbar } from "@/components/runs/runs-toolbar";

export default async function RunsPage({
  params,
  searchParams,
}: {
  params: { workspaceId: string };
  searchParams: { status?: string; agentId?: string };
}) {
  await requireWorkspaceMembership(params.workspaceId);
  const where: any = { workspaceId: params.workspaceId };
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.agentId) where.agentId = searchParams.agentId;

  const [runs, agents] = await Promise.all([
    prisma.run.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { agent: true, model: true, providerAccount: { include: { provider: true } } },
    }),
    prisma.agent.findMany({
      where: { workspaceId: params.workspaceId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Runs</h1>
          <p className="text-sm text-muted-foreground">{runs.length} executions</p>
        </div>
      </div>

      <RunsToolbar workspaceId={params.workspaceId} agents={agents} currentStatus={searchParams.status} currentAgent={searchParams.agentId} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent / Type</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No runs match this filter.</TableCell></TableRow>
            )}
            {runs.map((run) => (
              <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`/w/${params.workspaceId}/runs/${run.id}`} className="absolute inset-0" />
                  <div className="font-medium">{run.agent?.name ?? "Ad-hoc"}</div>
                  <div className="text-xs text-muted-foreground">{run.triggerType}</div>
                </TableCell>
                <TableCell className="text-sm">{run.model?.modelId ?? "—"}</TableCell>
                <TableCell><Badge variant={statusVariant(run.status)}>{run.status}</Badge></TableCell>
                <TableCell className="text-sm tabular-nums">{run.totalTokens.toLocaleString()}</TableCell>
                <TableCell className="text-sm tabular-nums">{formatCurrency(run.estimatedCost)}</TableCell>
                <TableCell className="text-sm">{formatDuration(run.durationMs)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatRelativeTime(run.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
