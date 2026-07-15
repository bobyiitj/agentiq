import OpenAI from "openai";
import type {
  ChatRequest,
  ModelInfo,
  ProviderAdapter,
  ProviderCredentials,
  StreamEvent,
  TokenUsage,
} from "../types";
import { estimateMessagesTokens } from "@/lib/ai/cost";

const OPENROUTER_MODELS: ModelInfo[] = [
  { id: "openai/gpt-4o", name: "GPT-4o (via OpenRouter)", contextWindow: 128000, maxOutputTokens: 4096, inputCostPer1k: 0.0025, outputCostPer1k: 0.01, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (via OpenRouter)", contextWindow: 128000, maxOutputTokens: 4096, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet (via OpenRouter)", contextWindow: 200000, maxOutputTokens: 8192, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: { streaming: true, tools: true, vision: true, jsonMode: false } },
  { id: "anthropic/claude-3-haiku", name: "Claude 3 Haiku (via OpenRouter)", contextWindow: 200000, maxOutputTokens: 4096, inputCostPer1k: 0.00025, outputCostPer1k: 0.00125, capabilities: { streaming: true, tools: true, vision: false, jsonMode: false } },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash (via OpenRouter)", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B (via OpenRouter)", contextWindow: 131072, maxOutputTokens: 4096, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: { streaming: true, tools: false, vision: false, jsonMode: false } },
  { id: "mistralai/mistral-large", name: "Mistral Large (via OpenRouter)", contextWindow: 128000, maxOutputTokens: 4096, inputCostPer1k: 0.003, outputCostPer1k: 0.009, capabilities: { streaming: true, tools: true, vision: false, jsonMode: false } },
];

export class OpenRouterAdapter implements ProviderAdapter {
  readonly name = "openrouter";
  private client: OpenAI;

  constructor(creds: ProviderCredentials) {
    this.client = new OpenAI({
      apiKey: creds.apiKey,
      baseURL: creds.baseUrl || "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "https://agentos.dev", "X-Title": "AgentOS" },
      timeout: 120_000,
    });
  }

  async chat(req: ChatRequest) {
    const res = await this.client.chat.completions.create({
      model: req.model,
      messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      top_p: req.topP,
      stream: false,
    }, { signal: req.signal });
    const choice = res.choices[0];
    const usage: TokenUsage = {
      promptTokens: res.usage?.prompt_tokens ?? 0,
      completionTokens: res.usage?.completion_tokens ?? 0,
      totalTokens: res.usage?.total_tokens ?? 0,
    };
    return { content: choice.message.content ?? "", usage };
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    try {
      const stream = await this.client.chat.completions.create({
        model: req.model,
        messages: req.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        top_p: req.topP,
        stream: true,
      }, { signal: req.signal });
      let completionTokens = 0;
      for await (const chunk of stream) {
        if (req.signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          completionTokens += Math.ceil(delta.length / 4);
          yield { type: "token", content: delta };
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
      if (err?.name === "APIUserAbortError" || err?.name === "AbortError") return;
      yield { type: "error", error: err instanceof Error ? err.message : "openrouter error" };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models");
      if (res.ok) {
        const data = await res.json();
        if (data.data?.length) {
          return data.data.map((m: any) => ({
            id: m.id,
            name: m.name || m.id,
            contextWindow: m.context_length || 128000,
            maxOutputTokens: 4096,
            inputCostPer1k: parseFloat(m.pricing?.prompt) || 0.001,
            outputCostPer1k: parseFloat(m.pricing?.completion) || 0.003,
            capabilities: {
              streaming: true,
              tools: m.id.includes("gpt") || m.id.includes("claude") || m.id.includes("gemini"),
              vision: m.id.includes("vision") || m.id.includes("4o") || m.id.includes("claude"),
              jsonMode: m.id.includes("gpt") || m.id.includes("gemini"),
            },
          }));
        }
      }
    } catch {}
    return OPENROUTER_MODELS;
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}