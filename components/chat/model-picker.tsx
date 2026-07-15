"use client";
import * as React from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
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

export interface ModelOption {
  id: string;
  modelId: string;
  displayName: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  contextWindow: number;
}

export interface AccountGroup {
  accountId: string;
  label: string;
  provider: string;
  providerDisplayName: string;
  models: ModelOption[];
}

export function ModelPicker({
  accounts,
  value,
  onChange,
  multi,
  selected,
  onToggle,
}: {
  accounts: AccountGroup[];
  value?: string;
  onChange?: (accountId: string, modelId: string) => void;
  multi?: boolean;
  selected?: { accountId: string; modelId: string; tag: string }[];
  onToggle?: (target: { accountId: string; modelId: string; tag: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const current = (() => {
    if (!value) return null;
    for (const acc of accounts) {
      const m = acc.models.find((x) => x.id === value);
      if (m) return { acc, m };
    }
    return null;
  })();

  if (multi) {
    return (
      <div className="flex flex-wrap gap-2">
        {selected?.map((s) => {
          const m = accounts.find((a) => a.accountId === s.accountId)?.models.find((x) => x.id === s.modelId);
          return (
            <span key={s.tag} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium">
              {m?.displayName ?? s.modelId}
              <button onClick={() => onToggle?.(s)} className="opacity-60 hover:opacity-100">×</button>
            </span>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3 w-3" /> Add model</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-64 overflow-y-auto">
            {accounts.map((acc) => (
              <div key={acc.accountId}>
                <DropdownMenuLabel>{acc.label} · {acc.providerDisplayName}</DropdownMenuLabel>
                {acc.models.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => onToggle?.({ accountId: acc.accountId, modelId: m.id, tag: m.modelId })}
                  >
                    {m.displayName}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {current ? current.m.displayName : "Select model"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 w-72 overflow-y-auto">
        {accounts.map((acc) => (
          <div key={acc.accountId}>
            <DropdownMenuLabel>{acc.label} · {acc.providerDisplayName}</DropdownMenuLabel>
            {acc.models.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => {
                  onChange?.(acc.accountId, m.id);
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                <div className="flex w-full items-center justify-between">
                  <span>{m.displayName}</span>
                  <span className="text-xs text-muted-foreground">${(m.inputCostPer1k * 1000).toFixed(2)}/M</span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
        {accounts.length === 0 && <DropdownMenuLabel>No providers connected</DropdownMenuLabel>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
