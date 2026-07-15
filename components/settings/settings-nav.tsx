"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserCog, Users, KeyRound, Webhook, SlidersHorizontal } from "lucide-react";

const SECTIONS = [
  { label: "Profile", href: "", icon: UserCog },
  { label: "Members", href: "/members", icon: Users },
  { label: "Providers", href: "/providers", icon: KeyRound },
  { label: "API Keys", href: "/api-keys", icon: SlidersHorizontal },
  { label: "Webhooks", href: "/webhooks", icon: Webhook },
];

export function SettingsNav({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  return (
    <nav className="w-48 space-y-1">
      {SECTIONS.map((s) => {
        const href = `/w/${workspaceId}/settings${s.href}`;
        const active = pathname === href;
        return (
          <Link
            key={s.label}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
            )}
          >
            <s.icon className="h-4 w-4" /> {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
