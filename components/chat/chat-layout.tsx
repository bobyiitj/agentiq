"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConversationSidebar } from "@/components/chat/conversation-sidebar";
import { ChatRunner } from "@/components/chat/chat-runner";
import { MessageSquare, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ChatLayoutProps {
  workspaceId: string;
  accounts: any[];
  conversations: any[];
  activeConversationId?: string;
  initialMessages?: any[];
  agentId?: string;
  agentName?: string;
  agentSystemPrompt?: string;
}

export function ChatLayout({
  workspaceId,
  accounts,
  conversations,
  activeConversationId,
  initialMessages,
  agentId,
  agentName,
  agentSystemPrompt,
}: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [conversationsList, setConversationsList] = React.useState(conversations);

  const handleConversationUpdated = React.useCallback(() => {
    // Refetch conversation list from server
    fetch(`/api/workspaces/${workspaceId}/conversations?limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.conversations) setConversationsList(data.conversations);
      })
      .catch(() => {});
  }, [workspaceId]);

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        setMobileSidebarOpen((prev) => !prev);
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setMobileSidebarOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - desktop */}
      <div
        className={cn(
          "hidden lg:flex flex-col border-r border-border/50 transition-all duration-200",
          sidebarOpen ? "w-72" : "w-0 border-r-0"
        )}
      >
        {sidebarOpen && (
          <ConversationSidebar
            workspaceId={workspaceId}
            userId={""}
            initialConversations={conversationsList}
            activeConversationId={activeConversationId}
            onConversationUpdated={handleConversationUpdated}
          />
        )}
      </div>

      {/* Sidebar - mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-80 flex-col bg-background shadow-xl transition-transform duration-200 lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
          <span className="font-semibold">Chat History</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileSidebarOpen(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ConversationSidebar
          workspaceId={workspaceId}
          userId={""}
          initialConversations={conversationsList}
          activeConversationId={activeConversationId}
          onConversationUpdated={handleConversationUpdated}
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sidebar toggle bar */}
        <div className="flex items-center border-b border-border/50 bg-card/50 px-2 py-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex h-7 w-7 p-0"
            title="Toggle sidebar"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMobileSidebarOpen(true)}
            className="lg:hidden h-7 w-7 p-0"
            title="Open sidebar"
          >
            <Menu className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Chat runner */}
        <div className="flex-1 overflow-hidden">
          <ChatRunner
            workspaceId={workspaceId}
            accounts={accounts}
            agentId={agentId}
            agentName={agentName}
            agentSystemPrompt={agentSystemPrompt}
            conversationId={activeConversationId}
            initialMessages={initialMessages}
            onConversationUpdated={handleConversationUpdated}
          />
        </div>
      </div>
    </div>
  );
}
