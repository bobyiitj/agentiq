import OpenAI from "openai";
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

const DEFAULT_TIMEOUT = 120_000;

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = "openai";
  private client: OpenAI;
  private creds: ProviderCredentials;

  constructor(creds: ProviderCredentials) {
    this.creds = creds;
    this.client = new OpenAI({
      apiKey: creds.apiKey,
      baseURL: creds.baseUrl,
      timeout: DEFAULT_TIMEOUT,
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
      yield { type: "error", error: err instanceof Error ? err.message : "openai error" };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await this.client.models.list();
    return res.data.map((m) => ({
      id: m.id,
      name: m.id,
      contextWindow: 128000,
      maxOutputTokens: 4096,
      inputCostPer1k: 0.01,
      outputCostPer1k: 0.03,
      capabilities: {
        streaming: true,
        tools: true,
        vision: m.id.includes("4o") || m.id.includes("vision"),
        jsonMode: true,
      },
    }));
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
