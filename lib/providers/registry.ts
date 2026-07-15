import { ProviderAdapter, ProviderCredentials } from "./types";
import { OpenAIAdapter } from "./adapters/openai";
import { AnthropicAdapter } from "./adapters/anthropic";
import { GeminiAdapter } from "./adapters/gemini";
import { NvidiaAdapter } from "./adapters/nvidia";
import { OpenRouterAdapter } from "./adapters/openrouter";

const registry: Record<string, new (c: ProviderCredentials) => ProviderAdapter> = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  gemini: GeminiAdapter,
  nvidia: NvidiaAdapter,
  openrouter: OpenRouterAdapter,
};

export function createAdapter(provider: string, creds: ProviderCredentials): ProviderAdapter {
  const Ctor = registry[provider.toLowerCase()];
  if (!Ctor) throw new Error(`Unsupported provider: ${provider}`);
  return new Ctor(creds);
}

export function supportedProviders(): string[] {
  return Object.keys(registry);
}
