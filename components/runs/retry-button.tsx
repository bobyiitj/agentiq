"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function RetryRunButton({
  workspaceId,
  runId,
  agentId,
}: {
  workspaceId: string;
  runId: string;
  agentId?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function retry() {
    setLoading(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/runs/${runId}/retry`, { method: "POST" });
    if (res.ok) {
      const { runId: newId } = await res.json();
      toast.success("Re-run started");
      router.push(`/w/${workspaceId}/runs/${newId}`);
      router.refresh();
    } else {
      toast.error("Retry failed");
    }
    setLoading(false);
  }

  return (
    <Button size="sm" variant="outline" onClick={retry} disabled={loading}>
      <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Retry
    </Button>
  );
}
