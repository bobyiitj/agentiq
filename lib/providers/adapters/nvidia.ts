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

const NVIDIA_MODELS: ModelInfo[] = [
  { id: "meta/llama-3.1-405b-instruct", name: "Llama 3.1 405B Instruct", contextWindow: 131072, maxOutputTokens: 4096, inputCostPer1k: 0.003, outputCostPer1k: 0.015, capabilities: { streaming: true, tools: false, vision: false, jsonMode: false } },
  { id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct", contextWindow: 131072, maxOutputTokens: 4096, inputCostPer1k: 0.0009, outputCostPer1k: 0.003, capabilities: { streaming: true, tools: false, vision: false, jsonMode: false } },
  { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", contextWindow: 131072, maxOutputTokens: 4096, inputCostPer1k: 0.0002, outputCostPer1k: 0.0006, capabilities: { streaming: true, tools: false, vision: false, jsonMode: false } },
  { id: "mistralai/mistral-large-2-instruct", name: "Mistral Large 2", contextWindow: 128000, maxOutputTokens: 4096, inputCostPer1k: 0.003, outputCostPer1k: 0.009, capabilities: { streaming: true, tools: false, vision: false, jsonMode: false } },
  { id: "google/gemma-2-27b-it", name: "Gemma 2 27B", contextWindow: 8192, maxOutputTokens: 4096, inputCostPer1k: 0.0002, outputCostPer1k: 0.0004, capabilities: { streaming: true, tools: false, vision: false, jsonMode: false } },
];

export class NvidiaAdapter implements ProviderAdapter {
  readonly name = "nvidia";
  private client: OpenAI;

  constructor(creds: ProviderCredentials) {
    this.client = new OpenAI({
      apiKey: creds.apiKey,
      baseURL: creds.baseUrl || "https://integrate.api.nvidia.com/v1",
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
      yield { type: "error", error: err instanceof Error ? err.message : "nvidia error" };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await this.client.models.list();
      if (res.data.length) {
        return res.data.map((m) => ({
          id: m.id,
          name: m.id.split("/").pop() || m.id,
          contextWindow: 131072,
          maxOutputTokens: 4096,
          inputCostPer1k: 0.001,
          outputCostPer1k: 0.003,
          capabilities: { streaming: true, tools: false, vision: false, jsonMode: false },
        }));
      }
    } catch {}
    return NVIDIA_MODELS;
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
