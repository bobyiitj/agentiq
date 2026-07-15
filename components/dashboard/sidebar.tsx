"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Plus, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { WorkspaceSwitcher } from "@/components/common/workspace-switcher";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Sidebar({ workspaceId, role }: { workspaceId: string; role: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 flex-col border-r border-border/50 bg-gradient-to-b from-card via-card to-card/80">
      <div className="flex h-14 items-center gap-2.5 border-b border-border/50 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md shadow-primary/20">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold tracking-tight">AgentOS</span>
        <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">v0.1</span>
      </div>

      <div className="p-3">
        <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-0.5 pb-4">
          {NAV_ITEMS.map((item) => {
            const href = item.href(workspaceId);
            const active = pathname === href || (href !== `/w/${workspaceId}` && pathname.startsWith(href));
            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                  active ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground group-hover:bg-accent group-hover:text-foreground"
                )}>
                  <item.icon className="h-3.5 w-3.5" />
                </div>
                {item.label}
                {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="border-t border-border/50 p-3">
        <Link href={`/w/${workspaceId}/agents/new`} className="w-full">
          <Button className="w-full gap-2 shadow-sm" size="sm">
            <Plus className="h-3.5 w-3.5" /> New Agent
          </Button>
        </Link>
      </div>
    </aside>
  );
}
