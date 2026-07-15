import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/utils";

export default async function LogsPage({ params }: { params: { workspaceId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const logs = await prisma.activityLog.findMany({
    where: { workspaceId: params.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Append-only record of security-relevant actions.</p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No activity recorded yet.</TableCell></TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatRelativeTime(log.createdAt)}</TableCell>
                <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                <TableCell className="text-sm">{log.resource}{log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}</TableCell>
                <TableCell className="text-sm">{log.user?.name ?? log.user?.email ?? "system"}</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {log.metadata ? JSON.stringify(log.metadata) : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
