import Anthropic from "@anthropic-ai/sdk";
import type {
  ChatMessage,
  ChatRequest,
  ModelInfo,
  ProviderAdapter,
  ProviderCredentials,
  StreamEvent,
  TokenUsage,
} from "../types";
import { estimateMessagesTokens } from "@/lib/ai/cost";

function toAnthropicMessages(messages: ChatMessage[]) {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const convo = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
  return { system, convo };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic";
  private client: Anthropic;
  private creds: ProviderCredentials;

  constructor(creds: ProviderCredentials) {
    this.creds = creds;
    this.client = new Anthropic({ apiKey: creds.apiKey, baseURL: creds.baseUrl, timeout: 120_000 });
  }

  async chat(req: ChatRequest) {
    const { system, convo } = toAnthropicMessages(req.messages);
    const res = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      temperature: req.temperature,
      system: system || undefined,
      messages: convo,
    }, { signal: req.signal } as any);
    const content = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const usage: TokenUsage = {
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens,
      totalTokens: res.usage.input_tokens + res.usage.output_tokens,
    };
    return { content, usage };
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    try {
      const { system, convo } = toAnthropicMessages(req.messages);
      const stream = this.client.messages.stream({
        model: req.model,
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature,
        system: system || undefined,
        messages: convo,
      }, { signal: req.signal } as any);
      let completionTokens = 0;
      for await (const event of stream) {
        if (req.signal?.aborted) break;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          completionTokens += Math.ceil(event.delta.text.length / 4);
          yield { type: "token", content: event.delta.text };
        }
      }
      yield {
        type: "done",
        usage: {
          promptTokens: estimateMessagesTokens(req.messages),
          completionTokens,
          totalTokens: estimateMessagesTokens(req.messages) + completionTokens,
        },
      };
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      yield { type: "error", error: err instanceof Error ? err.message : "anthropic error" };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const models = [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, maxOutputTokens: 64000, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet v2", contextWindow: 200000, maxOutputTokens: 8192, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutputTokens: 8192, inputCostPer1k: 0.001, outputCostPer1k: 0.005, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", contextWindow: 200000, maxOutputTokens: 4096, inputCostPer1k: 0.015, outputCostPer1k: 0.075, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", contextWindow: 200000, maxOutputTokens: 4096, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", contextWindow: 200000, maxOutputTokens: 4096, inputCostPer1k: 0.00025, outputCostPer1k: 0.00125, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
    ];
    try {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": this.creds.apiKey, "anthropic-version": "2023-06-01" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data?.length) {
          return data.data.map((m: any) => ({
            id: m.id,
            name: m.display_name || m.id,
            contextWindow: 200000,
            maxOutputTokens: 8192,
            inputCostPer1k: 0.003,
            outputCostPer1k: 0.015,
            capabilities: { streaming: true, tools: true, vision: true, jsonMode: true },
          }));
        }
      }
    } catch {}
    return models;
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: "claude-3-haiku-latest",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch {
      return false;
    }
  }
}
