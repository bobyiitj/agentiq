import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CostTrendChart } from "@/components/usage/cost-trend-chart";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function UsagePage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const wsId = params.workspaceId;

  const [totals, byModel, byProvider, runCount, days] = await Promise.all([
    prisma.usageRecord.aggregate({ where: { workspaceId: wsId }, _sum: { totalCost: true, totalTokens: true } }),
    prisma.usageRecord.groupBy({
      by: ["modelId"],
      where: { workspaceId: wsId },
      _sum: { totalCost: true, totalTokens: true },
    }),
    prisma.usageRecord.groupBy({
      by: ["providerAccountId"],
      where: { workspaceId: wsId },
      _sum: { totalCost: true, totalTokens: true },
    }),
    prisma.run.count({ where: { workspaceId: wsId, status: "COMPLETED" } }),
    prisma.$queryRaw<{ date: string; cost: number }[]>`
      SELECT to_char("recordedAt", 'MM-DD') as date,
             COALESCE(SUM("totalCost"),0)::float8 as cost
      FROM "UsageRecord"
      WHERE "workspaceId" = ${wsId}
        AND "recordedAt" > now() - interval '30 days'
      GROUP BY to_char("recordedAt", 'MM-DD')
      ORDER BY date
    `,
  ]);

  const modelNames = await prisma.model.findMany({ where: { id: { in: byModel.map((m) => m.modelId).filter(Boolean) as string[] } } });
  const nameMap = new Map(modelNames.map((m) => [m.id, m.modelId]));

  const providerIds = byProvider.map((p) => p.providerAccountId).filter(Boolean) as string[];
  const providerAccounts = await prisma.workspaceProviderAccount.findMany({ where: { id: { in: providerIds } } });
  const provNameMap = new Map(providerAccounts.map((p) => [p.id, p.label]));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Usage & Cost</h1>
        <p className="text-sm text-muted-foreground">Token consumption and spend across providers.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Spend</p><p className="text-2xl font-bold tabular-nums">{formatCurrency(totals._sum.totalCost ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Tokens</p><p className="text-2xl font-bold tabular-nums">{formatNumber(totals._sum.totalTokens ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Completed Runs</p><p className="text-2xl font-bold tabular-nums">{formatNumber(runCount)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Avg Cost / Run</p><p className="text-2xl font-bold tabular-nums">{formatCurrency(runCount ? (totals._sum.totalCost ?? 0) / runCount : 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cost Trend (30 days)</CardTitle></CardHeader>
        <CardContent>
          <CostTrendChart data={days.map((d) => ({ date: d.date, cost: Number(d.cost) }))} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">By Model</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Tokens</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
              <TableBody>
                {byModel.map((m) => (
                  <TableRow key={m.modelId}>
                    <TableCell className="font-medium">{m.modelId ? nameMap.get(m.modelId) ?? m.modelId : "Unknown"}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(m._sum?.totalTokens ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m._sum?.totalCost ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {byModel.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No usage yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">By Provider Account</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Tokens</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
              <TableBody>
                {byProvider.map((p) => (
                  <TableRow key={p.providerAccountId}>
                    <TableCell className="font-medium">{p.providerAccountId ? provNameMap.get(p.providerAccountId) ?? p.providerAccountId : "Unknown"}</TableCell>
                    <TableCell className="tabular-nums">{formatNumber(p._sum?.totalTokens ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p._sum?.totalCost ?? 0)}</TableCell>
                  </TableRow>
                ))}
                {byProvider.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No usage yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
