/**
 * Smoke-test every LLM router tier.
 *
 * Pings each Models alias with a trivial prompt and prints the model that
 * answered + duration. Useful after model-stack upgrades to confirm Ollama has
 * the new tags pulled (and OpenAI fallback works when allowed).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/smoke-llm-router.ts
 */

import { chat, Models, type ModelAlias } from "../src/lib/llm-router";

const TIERS: ModelAlias[] = [
  Models.FAST,
  Models.AGENT,
  Models.CONTENT,
  Models.QUALITY,
  Models.HERMES,
  Models.REASONING,
];

async function ping(tier: ModelAlias) {
  const start = Date.now();
  try {
    const resp = await chat(
      tier,
      [
        { role: "system", content: "You are a smoke-test bot. Reply with one short sentence." },
        { role: "user", content: "Say 'hi' and your model name." },
      ],
      {
        temperature: 0.1,
        timeoutMs: 30_000,
        allowOpenAIFallback: true,
        fallbackSeverity: "low",
      },
    );
    const ms = Date.now() - start;
    console.log(
      `[OK ] ${tier.padEnd(10)} ${ms.toString().padStart(5)}ms via ${resp.model ?? "?"} :: ${resp.content.slice(0, 80).replace(/\s+/g, " ")}`,
    );
    return true;
  } catch (err) {
    const ms = Date.now() - start;
    console.log(
      `[ERR] ${tier.padEnd(10)} ${ms.toString().padStart(5)}ms :: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

async function main() {
  console.log(`Smoke-testing ${TIERS.length} LLM tiers…\n`);
  let ok = 0;
  for (const t of TIERS) {
    if (await ping(t)) ok++;
  }
  console.log(`\n${ok}/${TIERS.length} tiers responded.`);
  process.exit(ok === TIERS.length ? 0 : 1);
}

main();
