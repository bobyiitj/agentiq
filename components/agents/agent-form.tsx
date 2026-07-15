"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function AgentForm({
  workspaceId,
  accounts,
  initial,
}: {
  workspaceId: string;
  accounts: any[];
  initial?: any;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = React.useState(initial?.systemPrompt ?? "");
  const [providerAccountId, setProviderAccountId] = React.useState(initial?.defaultProviderAccountId ?? "");
  const [modelId, setModelId] = React.useState(initial?.defaultModelId ?? "");
  const [temperature, setTemperature] = React.useState(initial?.config?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = React.useState(initial?.config?.maxTokens ?? 1024);
  const [topP, setTopP] = React.useState(initial?.config?.topP ?? 1);
  const [saving, setSaving] = React.useState(false);

  const availableModels = React.useMemo(() => {
    if (!providerAccountId) return [];
    return accounts.find((a: any) => a.accountId === providerAccountId)?.models ?? [];
  }, [providerAccountId, accounts]);

  async function submit() {
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error("Name and system prompt are required");
      return;
    }
    setSaving(true);
    const payload = {
      name,
      description: description || null,
      systemPrompt,
      defaultProviderAccountId: providerAccountId || null,
      defaultModelId: modelId || null,
      config: { temperature: Number(temperature), maxTokens: Number(maxTokens), topP: Number(topP) },
      status: initial?.status ?? "ACTIVE",
    };
    const url = initial
      ? `/api/workspaces/${workspaceId}/agents/${initial.id}`
      : `/api/workspaces/${workspaceId}/agents`;
    const res = await fetch(url, {
      method: initial ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(initial ? "Agent updated" : "Agent created");
      router.push(`/w/${workspaceId}/agents`);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      toast.error(err.error?.message ?? "Save failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Card>
        <CardHeader><CardTitle className="text-base">{initial ? "Edit Agent" : "New Agent"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Support Bot" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Handles tier-1 support" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              className="min-h-[140px] font-mono text-xs"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider Account</Label>
              <Select value={providerAccountId} onValueChange={(v) => { setProviderAccountId(v); setModelId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.accountId} value={a.accountId}>{a.label} · {a.providerDisplayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select value={modelId} onValueChange={setModelId} disabled={!providerAccountId}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {availableModels.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Temperature ({temperature})</Label>
              <Input type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input type="number" step="1" min="1" max="32000" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Top P ({topP})</Label>
              <Input type="number" step="0.05" min="0" max="1" value={topP} onChange={(e) => setTopP(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Agent"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
