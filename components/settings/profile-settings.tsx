"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function ProfileSettings({ workspaceId, initial }: { workspaceId: string; initial: any }) {
  const router = useRouter();
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setSaving(false);
    if (res.ok) { toast.success("Saved"); router.refresh(); }
    else toast.error("Save failed");
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Workspace Profile</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
