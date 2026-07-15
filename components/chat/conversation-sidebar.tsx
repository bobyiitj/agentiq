"use client";
import * as React from "react";
import {
  Bot,
  User,
  Search,
  Pin,
  Archive,
  Trash2,
  Copy,
  Plus,
  ChevronRight,
  ChevronDown,
  Clock,
  Filter,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { Conversation } from "@prisma/client";

export interface ConversationSidebarProps {
  workspaceId: string;
  userId: string;
  initialConversations: Array<
    Conversation & {
      agentName?: string | null;
      providerName?: string | null;
      modelName?: string | null;
      messageCount: number;
    }
  >;
  activeConversationId?: string;
  onConversationCreated?: () => void;
  onConversationUpdated?: () => void;
}

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  } else if (days < 30) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } else {
    return d.toLocaleDateString([], { month: "short", year: "2-digit" });
  }
};

const toDate = (v: string | Date) => new Date(v).getTime();

const sortConversations = (
  conversations: ConversationSidebarProps["initialConversations"],
  sortBy: "updated" | "newest" | "oldest" | "alphabetical"
) => {
  const sorted = [...conversations];
  switch (sortBy) {
    case "newest":
      return sorted.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
    case "oldest":
      return sorted.sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt));
    case "alphabetical":
      return sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "updated":
    default:
      return sorted.sort((a, b) => toDate(b.updatedAt) - toDate(a.updatedAt));
  }
};

function filterConversations(
  conversations: ConversationSidebarProps["initialConversations"],
  searchQuery: string,
  filters: {
    showArchived: boolean;
    showPinned: boolean;
    agentId?: string;
    providerId?: string;
    modelId?: string;
    tags?: string[];
  }
) {
  return conversations.filter((c) => {
    if (filters.showArchived === false && c.isArchived) return false;
    if (filters.showPinned === false && c.isPinned) return false;
    if (filters.agentId && c.agentId !== filters.agentId) return false;
    if (filters.providerId && c.providerId !== filters.providerId) return false;
    if (filters.modelId && c.modelId !== filters.modelId) return false;
    if (filters.tags?.length) {
      if (!c.tags?.length || !filters.tags.some((tag) => c.tags?.includes(tag))) {
        return false;
      }
    }

    const query = searchQuery.toLowerCase();
    if (query) {
      const match =
        (c.title || "").toLowerCase().includes(query) ||
        (c.lastMessageAt && formatDate(c.lastMessageAt).toLowerCase().includes(query)) ||
        c.agentName?.toLowerCase().includes(query) ||
        c.providerName?.toLowerCase().includes(query) ||
        c.modelName?.toLowerCase().includes(query) ||
        c.tags?.some((tag) => tag.toLowerCase().includes(query));
      if (!match) return false;
    }

    return true;
  });
}

function getTagColor(tag: string) {
  const colors = [
    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    "bg-orange-500/10 text-orange-700 dark:text-orange-400",
    "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  ];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
}

export function ConversationSidebar({
  workspaceId,
  userId,
  initialConversations,
  activeConversationId,
  onConversationCreated,
  onConversationUpdated,
}: ConversationSidebarProps) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  const [conversations, setConversations] = React.useState(
    sortConversations(initialConversations, "updated")
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("updated");
  const [showArchived, setShowArchived] = React.useState(false);
  const [showPinned, setShowPinned] = React.useState(false);
  const [filterAgentId, setFilterAgentId] = React.useState<string>();
  const [filterProviderId, setFilterProviderId] = React.useState<string>();
  const [filterModelId, setFilterModelId] = React.useState<string>();
  const [filterTags, setFilterTags] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    const filtered = filterConversations(conversations, searchQuery, {
      showArchived,
      showPinned,
      agentId: filterAgentId,
      providerId: filterProviderId,
      modelId: filterModelId,
      tags: filterTags,
    });
    return sortConversations(filtered, sortBy as any);
  }, [
    conversations,
    searchQuery,
    sortBy,
    showArchived,
    showPinned,
    filterAgentId,
    filterProviderId,
    filterModelId,
    filterTags,
  ]);

  const getAgentOptions = React.useMemo(() => {
    const agents = Array.from(
      new Set(conversations.map((c) => ({ id: c.agentId, name: c.agentName })))
    ).filter((a) => a.id);
    return agents;
  }, [conversations]);

  const getProviderOptions = React.useMemo(() => {
    const providers = Array.from(
      new Set(
        conversations.map((c) => ({ id: c.providerId, name: c.providerName }))
      )
    ).filter((p) => p.id);
    return providers;
  }, [conversations]);

  const getModelOptions = React.useMemo(() => {
    const models = Array.from(
      new Set(conversations.map((c) => ({ id: c.modelId, name: c.modelName })))
    ).filter((m) => m.id);
    return models;
  }, [conversations]);

  const getTagOptions = React.useMemo(() => {
    const tags = Array.from(
      new Set(conversations.flatMap((c) => c.tags || []))
    );
    return tags;
  }, [conversations]);

  const clearFilters = () => {
    setSearchQuery("");
    setSortBy("updated");
    setShowArchived(false);
    setShowPinned(false);
    setFilterAgentId(undefined);
    setFilterProviderId(undefined);
    setFilterModelId(undefined);
    setFilterTags([]);
  };

  const hasActiveFilters = () => {
    return (
      searchQuery ||
      sortBy !== "updated" ||
      showArchived ||
      showPinned ||
      filterAgentId ||
      filterProviderId ||
      filterModelId ||
      filterTags.length > 0
    );
  };

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }

      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationId)
      );
      onConversationUpdated?.();
      toast.success("Conversation deleted");

      if (activeConversationId === conversationId) {
        router.push(`/w/${workspaceId}/chats/new`);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const handleArchive = async (conversationId: string, archived: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isArchived: archived, isPinned: archived ? false : undefined }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to archive conversation");
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, isArchived: archived, isPinned: archived ? false : c.isPinned }
            : c
        )
      );
      onConversationUpdated?.();
      toast.success(archived ? "Conversation archived" : "Conversation restored");
    } catch (error) {
      console.error("Error archiving conversation:", error);
      toast.error("Failed to update conversation");
    }
  };

  const handlePin = async (conversationId: string, pinned: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPinned: pinned }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to pin conversation");
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, isPinned: pinned } : c
        )
      );
      onConversationUpdated?.();
      toast.success(pinned ? "Conversation pinned" : "Conversation unpinned");
    } catch (error) {
      console.error("Error pinning conversation:", error);
      toast.error("Failed to update conversation");
    }
  };

  const handleRename = async (conversationId: string, newTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to rename conversation");
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, title: newTitle } : c
        )
      );
      onConversationUpdated?.();
      toast.success("Conversation renamed");
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast.error("Failed to rename conversation");
    }
  };

  const ConversationItem = ({ conv }: { conv: typeof filtered[0] }) => {
    const isActive = conv.id === activeConversationId;
    const hasMessages = conv.messageCount > 0;

    return (
      <div className="group relative">
        <Link
          href={`/w/${workspaceId}/chats/${conv.id}`}
          className={cn(
            "flex items-center gap-3 rounded-lg p-3 transition-all duration-150",
            "hover:bg-accent/50",
            isActive
              ? "bg-primary/10 border border-primary/20"
              : "border border-transparent"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-muted to-muted/70 border border-border/50">
            {hasMessages ? (
              <Bot className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Plus className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3
                className={cn(
                  "truncate text-sm font-medium",
                  isActive ? "text-primary" : "text-foreground"
                )}
                title={conv.title ?? undefined}
              >
                {conv.title || "New Chat"}
              </h3>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => handlePin(conv.id, !conv.isPinned, e)}
                  className="rounded p-1 hover:bg-accent"
                  title={conv.isPinned ? "Unpin" : "Pin"}
                >
                  <Pin
                    className={cn(
                      "h-3.5 w-3.5",
                      conv.isPinned ? "fill-current text-primary" : "text-muted-foreground"
                    )}
                  />
                </button>
                <button
                  onClick={(e) => handleArchive(conv.id, !conv.isArchived, e)}
                  className="rounded p-1 hover:bg-accent"
                  title={conv.isArchived ? "Restore" : "Archive"}
                >
                  <Archive
                    className={cn(
                      "h-3.5 w-3.5",
                      conv.isArchived ? "fill-current text-orange-500" : "text-muted-foreground"
                    )}
                  />
                </button>
                <button
                  onClick={(e) => handleDelete(conv.id, e)}
                  className="rounded p-1 hover:bg-destructive/10 hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {conv.isPinned && <Pin className="h-3 w-3 fill-current text-primary" />}
              {conv.isArchived && <Archive className="h-3 w-3 fill-current text-orange-500" />}
              {conv.lastMessageAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(conv.lastMessageAt)}
                </span>
              )}
              {conv.agentName && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  {conv.agentName}
                </span>
              )}
              {conv.providerName && conv.modelName && (
                <span className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-muted-foreground/70">
                    {conv.providerName}/{conv.modelName}
                  </span>
                </span>
              )}
              {conv.messageCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {conv.messageCount}
                </Badge>
              )}
            </div>

            {conv.tags && conv.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {conv.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn("text-[10px] h-5", getTagColor(tag))}
                  >
                    {tag}
                  </Badge>
                ))}
                {conv.tags.length > 3 && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    +{conv.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-card/50">
      <div className="p-4 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Conversations</h2>
          <Button
            size="sm"
            onClick={() => router.push(`/w/${workspaceId}/chats/new`)}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between mb-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-transparent border border-border/50 rounded px-2 py-1.5"
          >
            <option value="updated">Last updated</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="alphabetical">Alphabetical</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPinned(!showPinned)}
            className={cn("h-8 text-xs", showPinned && "text-primary")}
          >
            <Pin className="h-3.5 w-3.5 mr-1.5" />
            Pinned
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={cn("h-8 text-xs", showArchived && "text-orange-500")}
          >
            <Archive className="h-3.5 w-3.5 mr-1.5" />
            Archived ({conversations.filter((c) => c.isArchived).length})
          </Button>
        </div>

        {(showArchived || showPinned || hasActiveFilters()) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {searchQuery && (
              <Badge variant="secondary" className="text-xs">
                Search: {searchQuery}
                <button
                  onClick={() => setSearchQuery("")}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterAgentId && (
              <Badge variant="secondary" className="text-xs">
                Agent: {filterAgentId}
                <button
                  onClick={() => setFilterAgentId(undefined)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterProviderId && (
              <Badge variant="secondary" className="text-xs">
                Provider: {filterProviderId}
                <button
                  onClick={() => setFilterProviderId(undefined)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterModelId && (
              <Badge variant="secondary" className="text-xs">
                Model: {filterModelId}
                <button
                  onClick={() => setFilterModelId(undefined)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filterTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                Tag: {tag}
                <button
                  onClick={() =>
                    setFilterTags((prev) => prev.filter((t) => t !== tag))
                  }
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {hasActiveFilters() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Search className="h-8 w-8 opacity-40 mb-2" />
              <p className="text-sm">No conversations found</p>
              {hasActiveFilters() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}

          {filtered.map((conv) => (
            <ConversationItem key={conv.id} conv={conv} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}