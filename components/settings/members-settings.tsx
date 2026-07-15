"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function MembersSettings({ workspaceId, initialMembers, initialInvitations }: any) {
  const router = useRouter();
  const [members, setMembers] = React.useState(initialMembers);
  const [invitations, setInvitations] = React.useState(initialInvitations);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("MEMBER");
  const [saving, setSaving] = React.useState(false);

  async function invite() {
    if (!email) return;
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setSaving(false);
    if (res.ok) {
      const { invitation } = await res.json();
      setInvitations((p: any[]) => [...p, invitation]);
      setEmail("");
      toast.success("Invitation created. Share the link below.");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      toast.error(err.error ?? "Invite failed");
    }
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/invite/${token}`;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Invite Member</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MEMBER">Member</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="self-end" onClick={invite} disabled={saving}>{saving ? "…" : "Invite"}</Button>
          </div>
          {invitations.length > 0 && (
            <div className="space-y-2">
              {invitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="truncate">{inv.email} · <Badge variant="outline">{inv.role}</Badge></span>
                  <button onClick={() => { navigator.clipboard.writeText(inviteLink(inv.token)); toast.success("Link copied"); }} className="text-primary hover:underline">
                    <Copy className="h-3 w-3 inline mr-1" /> copy link
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Members ({members.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{m.user.name ?? m.user.email}</p>
                <p className="text-xs text-muted-foreground">{m.user.email}</p>
              </div>
              <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
