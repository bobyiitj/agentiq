import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROVIDERS = [
  {
    name: "openai",
    displayName: "OpenAI",
    description: "GPT-4o, o1, and the OpenAI model family.",
    baseUrl: "https://api.openai.com/v1",
  },
  {
    name: "anthropic",
    displayName: "Anthropic",
    description: "Claude 3 / 3.5 family.",
    baseUrl: "https://api.anthropic.com",
  },
  {
    name: "gemini",
    displayName: "Google Gemini",
    description: "Gemini 2.0 / 2.5 family.",
    baseUrl: undefined,
  },
  {
    name: "nvidia",
    displayName: "NVIDIA NIM",
    description: "Llama, Mistral, Gemma via NVIDIA inference endpoints.",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  },
  {
    name: "openrouter",
    displayName: "OpenRouter",
    description: "Unified gateway to 100+ models (OpenAI, Anthropic, Meta, Mistral, Google, and more).",
    baseUrl: "https://openrouter.ai/api/v1",
  },
];

async function main() {
  for (const p of PROVIDERS) {
    await prisma.provider.upsert({
      where: { name: p.name },
      update: { displayName: p.displayName, description: p.description, baseUrl: p.baseUrl },
      create: p,
    });
  }
  console.log("Seeded providers:", PROVIDERS.map((p) => p.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
