import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { requireWorkspaceMembership } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDuration, formatRelativeTime } from "@/lib/utils";
import { RetryRunButton } from "@/components/runs/retry-button";

export default async function RunDetailPage({ params }: { params: { workspaceId: string; runId: string } }) {
  await requireWorkspaceMembership(params.workspaceId);
  const run = await prisma.run.findUnique({
    where: { id: params.runId },
    include: {
      agent: true,
      model: true,
      providerAccount: { include: { provider: true } },
      steps: { orderBy: { stepNumber: "asc" } },
    },
  });
  if (!run || run.workspaceId !== params.workspaceId) notFound();

  const input = (run.input as any)?.messages ?? run.input;
  const output = run.output as any;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/w/${params.workspaceId}/runs`} className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="font-semibold">Run {run.id.slice(0, 8)}</h1>
            <p className="text-xs text-muted-foreground">{formatRelativeTime(run.createdAt)}</p>
          </div>
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        </div>
        {run.status === "FAILED" && (
          <RetryRunButton workspaceId={params.workspaceId} runId={run.id} agentId={run.agentId} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Model" value={run.model?.modelId ?? "—"} />
        <Metric label="Provider" value={run.providerAccount?.label ?? "—"} />
        <Metric label="Tokens" value={run.totalTokens.toLocaleString()} />
        <Metric label="Cost" value={formatCurrency(run.estimatedCost)} tone="info" />
        <Metric label="Duration" value={formatDuration(run.durationMs)} />
        <Metric label="Prompt Tokens" value={run.promptTokens.toLocaleString()} />
        <Metric label="Completion" value={run.completionTokens.toLocaleString()} />
        <Metric label="Trigger" value={run.triggerType} />
      </div>

      <Tabs defaultValue="output">
        <TabsList>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="steps">Steps ({run.steps.length})</TabsTrigger>
          {run.error && <TabsTrigger value="error">Error</TabsTrigger>}
        </TabsList>

        <TabsContent value="output">
          <Card><CardContent className="p-4">
            <pre className="whitespace-pre-wrap text-sm">{output?.content ?? "(no output)"}</pre>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="input">
          <Card><CardContent className="p-4">
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap text-xs scrollbar-thin">
              {JSON.stringify(input, null, 2)}
            </pre>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="steps" className="space-y-2">
          {run.steps.map((step) => (
            <Card key={step.id}><CardContent className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium">{step.name}</p>
                <p className="text-xs text-muted-foreground">{step.type} · step {step.stepNumber}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">{step.totalTokens.toLocaleString()} tok · {formatCurrency(step.estimatedCost)}</span>
                <Badge variant={statusVariant(step.status)}>{step.status}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        {run.error && (
          <TabsContent value="error">
            <Card><CardContent className="p-4">
              <pre className="whitespace-pre-wrap text-sm text-destructive">{run.error}</pre>
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "info" }) {
  return (
    <Card><CardContent className="p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === "info" ? "text-blue-500" : ""}`}>{value}</p>
    </CardContent></Card>
  );
}
