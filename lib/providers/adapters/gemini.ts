import { GoogleGenerativeAI } from "@google/generative-ai";
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

function toGeminiParts(messages: ChatMessage[]) {
  return messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

export class GeminiAdapter implements ProviderAdapter {
  readonly name = "gemini";
  private client: GoogleGenerativeAI;
  private creds: ProviderCredentials;

  constructor(creds: ProviderCredentials) {
    this.creds = creds;
    this.client = new GoogleGenerativeAI(creds.apiKey);
  }

  async chat(req: ChatRequest) {
    const model = this.client.getGenerativeModel({ model: req.model });
    const abortHandler = req.signal ? { signal: req.signal } : undefined;
    const result = await model.generateContent({
      contents: toGeminiParts(req.messages),
      generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens ?? 8192, topP: req.topP },
    }, abortHandler as any);
    const text = result.response.text();
    const usage: TokenUsage = {
      promptTokens: estimateMessagesTokens(req.messages),
      completionTokens: Math.ceil(text.length / 4),
      totalTokens: estimateMessagesTokens(req.messages) + Math.ceil(text.length / 4),
    };
    return { content: text, usage };
  }

  async *chatStream(req: ChatRequest): AsyncGenerator<StreamEvent> {
    try {
      const model = this.client.getGenerativeModel({ model: req.model });
      const abortHandler = req.signal ? { signal: req.signal } : undefined;
      const result = await model.generateContentStream({
        contents: toGeminiParts(req.messages),
        generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens ?? 8192, topP: req.topP },
      }, abortHandler as any);
      let completionTokens = 0;
      for await (const chunk of result.stream) {
        if (req.signal?.aborted) break;
        const text = chunk.text();
        if (text) {
          completionTokens += Math.ceil(text.length / 4);
          yield { type: "token", content: text };
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
      yield { type: "error", error: err instanceof Error ? err.message : "gemini error" };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const fallback: ModelInfo[] = [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1k: 0.00125, outputCostPer1k: 0.005, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1k: 0.00015, outputCostPer1k: 0.0006, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1k: 0.0001, outputCostPer1k: 0.0004, capabilities: { streaming: true, tools: true, vision: true, jsonMode: true } },
      { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite", contextWindow: 1000000, maxOutputTokens: 8192, inputCostPer1k: 0.000075, outputCostPer1k: 0.0003, capabilities: { streaming: true, tools: false, vision: true, jsonMode: false } },
    ];
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.creds.apiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.models?.length) {
          return data.models
            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m: any) => ({
              id: m.name.replace("models/", ""),
              name: m.displayName || m.name.replace("models/", ""),
              contextWindow: m.inputTokenLimit || 1000000,
              maxOutputTokens: m.outputTokenLimit || 8192,
              inputCostPer1k: 0.0001,
              outputCostPer1k: 0.0004,
              capabilities: {
                streaming: true,
                tools: m.supportedGenerationMethods?.includes("batchGenerateContent") ?? false,
                vision: m.name.includes("vision") || true,
                jsonMode: true,
              },
            }));
        }
      }
    } catch {}
    return fallback;
  }

  async validate(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });
      await model.generateContent("hi");
      return true;
    } catch {
      return false;
    }
  }
}
