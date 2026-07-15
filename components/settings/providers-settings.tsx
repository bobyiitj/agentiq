"use client";
import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, CheckCircle2, XCircle, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function ProvidersSettings({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/providers`)
      .then((r) => r.json().catch(() => ({ catalog: [], accounts: [] })))
      .then((d) => { setCatalog(d.catalog); setAccounts(d.accounts); setLoading(false); });
  }, [workspaceId]);

  async function removeProvider(accountId: string) {
    const res = await fetch(`/api/workspaces/${workspaceId}/providers`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (res.ok) {
      const data = await res.json();
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast.success("Provider removed");
      if (data.linkedAgents > 0) {
        toast.warning(`${data.linkedAgents} agent(s) were using this provider. Update them in Agents settings.`);
      }
    } else {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      toast.error(err.error || "Failed to remove provider");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-sm text-muted-foreground">Connect AI providers. Credentials are encrypted at rest (AES-256-GCM).</p>
      </div>

      <ConnectProvider workspaceId={workspaceId} catalog={catalog} onConnected={() => router.refresh()} />

      <Card>
        <CardHeader><CardTitle className="text-base">Connected Accounts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && accounts.length === 0 && <p className="text-sm text-muted-foreground">No providers connected yet.</p>}
          {accounts.map((a) => (
            <ProviderRow key={a.id} account={a} onRemove={removeProvider} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderRow({ account, onRemove }: { account: any; onRemove: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    await onRemove(account.id);
    setRemoving(false);
    setConfirming(false);
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted"><KeyRound className="h-4 w-4" /></div>
        <div>
          <p className="font-medium">{account.label}</p>
          <p className="text-xs text-muted-foreground">{account.providerDisplayName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {account.validationError ? (
          <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> error</Badge>
        ) : (
          <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> active</Badge>
        )}
        {confirming ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Remove?</span>
            <Button size="sm" variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? "…" : "Yes"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>No</Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectProvider({ workspaceId, catalog, onConnected }: any) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function connect() {
    if (!providerId || !label || !apiKey) { toast.error("All fields required"); return; }
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, label, apiKey, baseUrlOverride: baseUrl || null }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Provider connected");
      setOpen(false);
      setApiKey(""); setLabel(""); setProviderId(""); setBaseUrl("");
      onConnected();
    } else {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      toast.error(typeof err.error === "string" ? err.error : err.error?.message ?? "Connection failed");
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Connect Provider</Button>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Connect Provider</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="">Select…</option>
              {catalog.map((p: any) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Production OpenAI" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>API Key</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" />
        </div>
        <div className="space-y-2">
          <Label>Base URL Override (optional)</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={connect} disabled={saving}>{saving ? "Connecting…" : "Connect"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
