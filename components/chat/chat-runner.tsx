"use client";
import * as React from "react";
import { Bot, User, Loader2, Copy, Check, Sparkles, Square, RotateCcw, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ChatRole = "user" | "assistant";
export interface Msg {
  id: string;
  role: ChatRole;
  content: string;
  pending?: boolean;
  tag?: string;
  timestamp?: number;
  error?: boolean;
}

function formatTime(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        parts.push(
          <div key={`code-${i}`} className="my-2 overflow-hidden rounded-lg border border-border/50 bg-muted/50">
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/80 px-3 py-1">
              <span className="text-xs text-muted-foreground">{codeLang || "code"}</span>
              <CopyButton text={codeLines.join("\n")} />
            </div>
            <pre className="overflow-x-auto p-3 text-sm"><code>{codeLines.join("\n")}</code></pre>
          </div>
        );
        codeLines = [];
        codeLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    parts.push(<span key={`line-${i}`}>{line}{i < lines.length - 1 ? "\n" : ""}</span>);
  }
  if (inCodeBlock && codeLines.length) {
    parts.push(
      <div key="code-end" className="my-2 overflow-hidden rounded-lg border border-border/50 bg-muted/50">
        <pre className="overflow-x-auto p-3 text-sm"><code>{codeLines.join("\n")}</code></pre>
      </div>
    );
  }
  return parts.length ? parts : text;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied"); setTimeout(() => setCopied(false), 2000); }}
      className="rounded p-1 hover:bg-accent"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function MessageBubble({ msg, onRetry }: { msg: Msg; onRetry?: () => void }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = React.useState(false);

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
        isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-muted to-muted/70 border border-border/50"
      )}>
        {isUser ? <User className="h-4 w-4" /> : msg.error ? <AlertCircle className="h-4 w-4 text-destructive" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        "group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-md"
          : msg.error
            ? "bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-md"
            : "bg-card border border-border/50 shadow-sm rounded-tl-md"
      )}>
        {msg.tag && (
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-xs font-semibold text-primary">{msg.tag}</span>
          </div>
        )}
        {msg.content ? (
          <div className="whitespace-pre-wrap break-words">{renderMarkdown(msg.content)}</div>
        ) : msg.pending ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:0.4s]" />
          </span>
        ) : null}
        {msg.timestamp && (
          <span className="mt-1 block text-[10px] text-muted-foreground/60">{formatTime(msg.timestamp)}</span>
        )}
        {msg.content && !msg.pending && !isUser && (
          <div className="absolute -bottom-3 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={msg.content} />
            {onRetry && (
              <button onClick={onRetry} className="rounded bg-background p-1 shadow-sm hover:bg-accent border">
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatRunner({
  workspaceId,
  accounts,
  agentId,
  agentName,
  agentSystemPrompt,
  conversationId,
  initialMessages,
  onConversationUpdated,
}: {
  workspaceId: string;
  accounts: any[];
  agentId?: string;
  agentName?: string;
  agentSystemPrompt?: string;
  conversationId?: string;
  initialMessages?: Msg[];
  onConversationUpdated?: () => void;
}) {
  const [messages, setMessages] = React.useState<Msg[]>(initialMessages ?? []);
  const [input, setInput] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [mode, setMode] = React.useState<"single" | "compare">("single");
  const [single, setSingle] = React.useState<{ accountId: string; modelId: string } | null>(null);
  const [compareTargets, setCompareTargets] = React.useState<{ accountId: string; modelId: string; tag: string }[]>([]);
  const [activeConvoId, setActiveConvoId] = React.useState<string | undefined>(conversationId);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function buildPayload(history: Msg[], systemPrompt?: string) {
    const historyMsgs = history
      .filter((m) => !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    const msgs = systemPrompt
      ? [{ role: "system", content: systemPrompt }, ...historyMsgs]
      : historyMsgs;
    return msgs;
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    toast.info("Generation stopped");
  }

  async function send() {
    if (!input.trim() || running) return;
    if (mode === "single" && !single) {
      toast.error("Select a model first");
      return;
    }
    if (mode === "compare" && compareTargets.length === 0) {
      toast.error("Add at least one model to compare");
      return;
    }

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: input, timestamp: Date.now() };
    const assistantMsg: Msg = { id: crypto.randomUUID(), role: "assistant", content: "", pending: true, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setRunning(true);

    const payload = buildPayload([...messages, userMsg], agentSystemPrompt);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (mode === "single" && single) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            messages: payload,
            providerAccountId: single.accountId,
            modelId: single.modelId,
            agentId,
            conversationId: activeConvoId,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `Request failed (${res.status})`);
        }
        const convoHeader = res.headers.get("X-Conversation-Id");
        if (convoHeader && !activeConvoId) {
          setActiveConvoId(convoHeader);
          window.history.replaceState(null, "", `/w/${workspaceId}/chats/${convoHeader}`);
        }
        await consumeStream(res, (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + delta, pending: false } : m))
          );
        }, controller.signal);
        onConversationUpdated?.();
      } else {
        const res = await fetch("/api/chat/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, messages: payload, targets: compareTargets, conversationId: activeConvoId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `Request failed (${res.status})`);
        }
        const buffers: Record<string, string> = {};
        await consumeStream(res, (delta, tag) => {
          const key = tag ?? "default";
          buffers[key] = (buffers[key] ?? "") + delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: compareTargets.map((t) => `### ${t.tag}\n${buffers[t.tag] ?? ""}`).join("\n\n"), pending: false }
                : m
            )
          );
        }, controller.signal);
        onConversationUpdated?.();
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, pending: false, content: m.content || "Generation stopped." } : m
        ));
      } else {
        const msg = formatError(err.message);
        toast.error(msg);
        setMessages((prev) => prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, pending: false, error: true, content: msg } : m
        ));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function retryLastAssistant() {
    const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx === -1) return;
    const realIdx = messages.length - 1 - lastAssistantIdx;
    const prevUserIdx = realIdx - 1;
    if (prevUserIdx < 0 || messages[prevUserIdx].role !== "user") return;
    const userMsg = messages[prevUserIdx];
    setMessages((prev) => prev.slice(0, realIdx));
    setInput(userMsg.content);
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-card/50 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex rounded-lg border border-border/50 bg-muted/30 p-0.5 text-xs">
          <button
            className={cn("rounded-md px-3 py-1.5 font-medium transition-colors", mode === "single" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setMode("single")}
          >
            Single
          </button>
          <button
            className={cn("rounded-md px-3 py-1.5 font-medium transition-colors", mode === "compare" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setMode("compare")}
          >
            Compare
          </button>
        </div>

        {mode === "single" ? (
          <ModelPickerSingle accounts={accounts} value={single?.modelId} onChange={(accountId, modelId) => setSingle({ accountId, modelId })} />
        ) : (
          <ModelPickerMulti
            accounts={accounts}
            selected={compareTargets}
            onToggle={(t) =>
              setCompareTargets((prev) =>
                prev.some((x) => x.tag === t.tag) ? prev.filter((x) => x.tag !== t.tag) : [...prev, t]
              )
            }
          />
        )}
      </div>

      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="mx-auto max-w-3xl space-y-5 p-4">
          {messages.length === 0 && (
            <div className="flex h-[50vh] flex-col items-center justify-center text-center text-muted-foreground">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                <Bot className="h-8 w-8 text-primary/60" />
              </div>
              <p className="text-lg font-semibold">{agentName ? `Test ${agentName}` : "Prompt Runner"}</p>
              <p className="mt-1 text-sm">Send a prompt to {mode === "compare" ? "multiple models" : "a model"} and see responses stream in real time.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={m.id} msg={m} onRetry={m.role === "assistant" && !m.pending ? retryLastAssistant : undefined} />
          ))}
          {running && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Generating…
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/50 bg-card/50 p-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Enter a prompt…  (Enter to run, Shift+Enter for newline)"
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border/50 bg-background px-4 py-3 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            rows={2}
            disabled={running}
          />
          {running ? (
            <Button onClick={stopGeneration} variant="destructive" className="rounded-xl px-5 shadow-md" size="lg">
              <Square className="h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button onClick={send} disabled={!input.trim()} className="rounded-xl px-5 shadow-md shadow-primary/20" size="lg">
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("incorrect api key"))
    return "Invalid API key. Check your provider credentials in Settings.";
  if (lower.includes("403") || lower.includes("forbidden"))
    return "Access denied. Your API key doesn't have permission for this model.";
  if (lower.includes("404") || lower.includes("not found"))
    return "Model not found. It may have been renamed or removed by the provider.";
  if (lower.includes("408") || lower.includes("timeout"))
    return "Request timed out. The model is taking too long to respond. Try again or use a smaller context.";
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests"))
    return "Rate limited. Too many requests. Wait a moment and try again.";
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("internal server"))
    return "Provider is temporarily unavailable. Try again in a few moments.";
  if (lower.includes("context length") || lower.includes("context_window") || lower.includes("maximum context"))
    return "Message is too long for this model's context window. Try a shorter prompt.";
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("econnrefused"))
    return "Network error. Check your internet connection.";
  if (lower.includes("overloaded") || lower.includes("capacity"))
    return "Provider is at capacity. Try again shortly.";
  return "An unexpected error occurred. Please try again.";
}

async function consumeStream(res: Response, onToken: (delta: string, tag?: string) => void, signal?: AbortSignal) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      if (signal?.aborted) { reader.cancel(); break; }
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (signal?.aborted) break;
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const evt = JSON.parse(data);
          if (evt.type === "token") onToken(evt.content, evt.tag);
          else if (evt.type === "error") throw new Error(evt.error);
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function ModelPickerSingle({ accounts, value, onChange }: { accounts: any[]; value?: string; onChange?: (a: string, m: string) => void }) {
  let current: { acc: any; m: any } | null = null;
  for (const acc of accounts) {
    const m = acc.models.find((x: any) => x.id === value);
    if (m) { current = { acc, m }; break; }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          {current ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {current.m.displayName}
            </>
          ) : "Select model"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 w-72 overflow-y-auto">
        {accounts.map((acc: any) => (
          <React.Fragment key={acc.accountId}>
            <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">{acc.label} · {acc.providerDisplayName}</DropdownMenuLabel>
            {acc.models.map((m: any) => (
              <DropdownMenuItem key={m.id} onClick={() => onChange?.(acc.accountId, m.id)}>
                <span className="flex-1 font-medium">{m.displayName}</span>
                <span className="ml-4 text-xs text-muted-foreground tabular-nums">${(m.inputCostPer1k * 1000).toFixed(2)}/M</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </React.Fragment>
        ))}
        {accounts.length === 0 && <DropdownMenuLabel className="text-muted-foreground">No providers connected</DropdownMenuLabel>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelPickerMulti({ accounts, selected, onToggle }: { accounts: any[]; selected: any[]; onToggle: (t: any) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((s) => {
        const m = accounts.find((a) => a.accountId === s.accountId)?.models.find((x: any) => x.id === s.modelId);
        return (
          <span key={s.tag} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {m?.displayName ?? s.modelId}
            <button onClick={() => onToggle(s)} className="rounded-full hover:bg-primary/20 p-0.5">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
            </button>
          </span>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 border-dashed">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
            Add model
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 w-72 overflow-y-auto">
          {accounts.map((acc: any) => (
            <React.Fragment key={acc.accountId}>
              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">{acc.label} · {acc.providerDisplayName}</DropdownMenuLabel>
              {acc.models.map((m: any) => (
                <DropdownMenuItem key={m.id} onClick={() => onToggle({ accountId: acc.accountId, modelId: m.id, tag: m.modelId })}>
                  <span className="flex-1 font-medium">{m.displayName}</span>
                  <span className="ml-4 text-xs text-muted-foreground tabular-nums">${(m.inputCostPer1k * 1000).toFixed(2)}/M</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </React.Fragment>
          ))}
          {accounts.length === 0 && <DropdownMenuLabel className="text-muted-foreground">No providers connected</DropdownMenuLabel>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
