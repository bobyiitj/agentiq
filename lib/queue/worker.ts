// MVP uses inline execution for agent runs (see features/agents/runner.ts).
// This worker is the seam for moving to async BullMQ execution in Phase 2:
// it would consume `agent-run` jobs and call the same runner.
import { prisma } from "@/lib/db/prisma";

async function main() {
  console.log("[worker] AgentOS queue worker (placeholder). MVP runs execute inline.");
  // Phase 2: const worker = new Worker("agent-run", async (job) => { ... });
  await prisma.$disconnect();
}

main();
