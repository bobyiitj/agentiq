import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Activity,
  Workflow,
  BarChart3,
  ScrollText,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: (ws: string) => string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: "workspace" | "agents" | "runs" | "workflows" | "usage" | "logs" | "settings";
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: (ws) => `/w/${ws}`, icon: LayoutDashboard },
  { label: "Agents", href: (ws) => `/w/${ws}/agents`, icon: Bot, resource: "agents" },
  { label: "Chat", href: (ws) => `/w/${ws}/chats/new`, icon: MessageSquare },
  { label: "Runs", href: (ws) => `/w/${ws}/runs`, icon: Activity, resource: "runs" },
  { label: "Workflows", href: (ws) => `/w/${ws}/workflows`, icon: Workflow, resource: "workflows" },
  { label: "Usage", href: (ws) => `/w/${ws}/usage`, icon: BarChart3, resource: "usage" },
  { label: "Logs", href: (ws) => `/w/${ws}/logs`, icon: ScrollText, resource: "logs" },
  { label: "Settings", href: (ws) => `/w/${ws}/settings`, icon: Settings, resource: "settings" },
];
