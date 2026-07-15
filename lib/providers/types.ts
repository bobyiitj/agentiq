export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "done"; usage?: TokenUsage; runId?: string }
  | { type: "error"; error: string };

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  jsonMode: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capabilities: ModelCapabilities;
}

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface ProviderAdapter {
  readonly name: string;
  chat(req: ChatRequest): Promise<{ content: string; usage: TokenUsage }>;
  chatStream(req: ChatRequest): AsyncGenerator<StreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  validate(): Promise<boolean>;
}
