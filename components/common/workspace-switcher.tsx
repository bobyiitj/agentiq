"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function WorkspaceSwitcher({
  currentWorkspaceId,
  workspaces,
}: {
  currentWorkspaceId: string;
  workspaces?: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [list, setList] = useState(workspaces ?? []);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function ensureList() {
    if (list.length === 0) {
      const res = await fetch("/api/workspaces");
      if (res.ok) setList(await res.json());
    }
  }

  async function createWorkspace() {
    if (!name.trim()) return;
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const ws = await res.json();
      setCreating(false);
      setName("");
      router.push(`/w/${ws.id}`);
      router.refresh();
    }
  }

  const current = list.find((w) => w.id === currentWorkspaceId);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2 font-normal h-9 border-border/50 bg-muted/30 hover:bg-accent/50">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="h-3 w-3 text-primary" />
            </div>
            <span className="truncate text-sm">{current?.name ?? "Select workspace"}</span>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">Workspaces</DropdownMenuLabel>
        {list.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={() => {
              router.push(`/w/${w.id}`);
              setOpen(false);
            }}
            className="gap-2"
          >
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md",
              w.id === currentWorkspaceId ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
              <Building2 className="h-3 w-3" />
            </div>
            <span className="truncate flex-1">{w.name}</span>
            {w.id === currentWorkspaceId && <Check className="h-3.5 w-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {creating ? (
          <div className="p-2 space-y-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="flex h-8 w-full rounded-lg border border-border/50 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={createWorkspace}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <DropdownMenuItem onClick={() => { ensureList(); setCreating(true); }} className="gap-2 text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> New workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
