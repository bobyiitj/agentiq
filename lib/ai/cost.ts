// Lightweight token estimation (provider-accurate counting happens server-side
// per provider; this is a fast heuristic for pre-flight estimates).
const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(
  messages: { role: string; content: string }[]
): number {
  // ~4 tokens overhead per message + content
  return messages.reduce(
    (sum, m) => sum + 4 + estimateTokens(m.content),
    3
  );
}

export interface CostBreakdown {
  input: number;
  output: number;
  total: number;
}

export function calculateCost(params: {
  inputCostPer1k: number;
  outputCostPer1k: number;
  promptTokens: number;
  completionTokens: number;
}): CostBreakdown {
  const input = (params.promptTokens / 1000) * params.inputCostPer1k;
  const output = (params.completionTokens / 1000) * params.outputCostPer1k;
  return { input, output, total: input + output };
}
