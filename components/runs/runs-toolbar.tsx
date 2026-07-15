"use client";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RunsToolbar({
  workspaceId,
  agents,
  currentStatus,
  currentAgent,
}: {
  workspaceId: string;
  agents: { id: string; name: string }[];
  currentStatus?: string;
  currentAgent?: string;
}) {
  const router = useRouter();
  function update(key: string, value: string) {
    const params = new URLSearchParams();
    if (currentStatus && key !== "status") params.set("status", currentStatus);
    if (currentAgent && key !== "agentId") params.set("agentId", currentAgent);
    if (value && value !== "all") params.set(key, value);
    router.push(`/w/${workspaceId}/runs${params.toString() ? `?${params}` : ""}`);
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={currentStatus ?? "all"} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="COMPLETED">Completed</SelectItem>
          <SelectItem value="FAILED">Failed</SelectItem>
          <SelectItem value="RUNNING">Running</SelectItem>
          <SelectItem value="STREAMING">Streaming</SelectItem>
          <SelectItem value="CANCELLED">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={currentAgent ?? "all"} onValueChange={(v) => update("agentId", v)}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Agent" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All agents</SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
