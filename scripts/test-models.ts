/**
 * LockSafe Model Health Check
 *
 * Tests every Ollama tier (FAST, AGENT/HERMES/REASONING, CONTENT, VISION, EMBED)
 * with a real inference call. Prints pass/fail + latency for each.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/test-models.ts
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const MODELS = {
  FAST:      process.env.OLLAMA_MODEL_FAST      || "qwen2.5:3b",
  AGENT:     process.env.OLLAMA_MODEL_AGENT     || "qwen3:30b-a3b",
  HERMES:    process.env.OLLAMA_MODEL_HERMES    || "qwen3:30b-a3b",
  REASONING: process.env.OLLAMA_MODEL_REASONING || "qwen3:30b-a3b",
  CONTENT:   process.env.OLLAMA_MODEL_CONTENT   || "qwen3:32b",
  QUALITY:   process.env.OLLAMA_MODEL_QUALITY   || "qwen3:32b",
  VISION:    process.env.OLLAMA_MODEL_VISION    || "qwen2.5vl:7b",
  EMBED:     process.env.OLLAMA_MODEL_EMBED     || "nomic-embed-text",
};

type TestResult = {
  tier: string;
  model: string;
  passed: boolean;
  latencyMs: number;
  response?: string;
  error?: string;
};

// ── Chat test ────────────────────────────────────────────────────────────────

async function testChat(
  tier: string,
  model: string,
  prompt: string,
  systemPrompt?: string,
): Promise<TestResult> {
  const start = Date.now();
  try {
    const messages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ];

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { num_predict: 80, temperature: 0 },
      }),
      signal: AbortSignal.timeout(300_000), // 5 min — large models (qwen3:32b = 20GB) take 3-4 min cold
    });

    if (!res.ok) {
      const text = await res.text();
      return { tier, model, passed: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json() as { message?: { content: string }; error?: string };
    if (json.error) {
      return { tier, model, passed: false, latencyMs: Date.now() - start, error: json.error };
    }

    const content = json.message?.content?.trim() ?? "";
    return {
      tier, model, passed: content.length > 0,
      latencyMs: Date.now() - start,
      response: content.slice(0, 120),
    };
  } catch (err) {
    return { tier, model, passed: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

// ── Vision test (sends a tiny 1x1 white PNG as base64) ──────────────────────

const WHITE_1PX_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";

async function testVision(tier: string, model: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: "Describe this image in one word.",
          images: [WHITE_1PX_PNG],
        }],
        stream: false,
        options: { num_predict: 20, temperature: 0 },
      }),
      signal: AbortSignal.timeout(300_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return { tier, model, passed: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json() as { message?: { content: string }; error?: string };
    if (json.error) {
      return { tier, model, passed: false, latencyMs: Date.now() - start, error: json.error };
    }

    const content = json.message?.content?.trim() ?? "";
    return { tier, model, passed: content.length > 0, latencyMs: Date.now() - start, response: content };
  } catch (err) {
    return { tier, model, passed: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

// ── Embed test ───────────────────────────────────────────────────────────────

async function testEmbed(tier: string, model: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: "emergency locksmith london" }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text();
      return { tier, model, passed: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = await res.json() as { embeddings?: number[][]; error?: string };
    if (json.error) {
      return { tier, model, passed: false, latencyMs: Date.now() - start, error: json.error };
    }

    const dim = json.embeddings?.[0]?.length ?? 0;
    return {
      tier, model,
      passed: dim > 0,
      latencyMs: Date.now() - start,
      response: `Vector dim: ${dim}`,
    };
  } catch (err) {
    return { tier, model, passed: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

// ── Unique model deduplication ───────────────────────────────────────────────
// AGENT / HERMES / REASONING / CONTENT / QUALITY share 2 physical models.
// We test the unique models once and share the result across tiers.

async function runAll() {
  console.log(`\n🔍 LockSafe Model Health Check — ${new Date().toLocaleString("en-GB")}`);
  console.log(`   Ollama: ${OLLAMA_BASE}\n`);

  const results: TestResult[] = [];

  // 1. FAST
  results.push(await testChat("FAST", MODELS.FAST,
    "Reply with one word: working?"));
  printResult(results.at(-1)!);

  // 2. AGENT (qwen3:30b-a3b — represents HERMES + REASONING too)
  const agentResult = await testChat("AGENT / HERMES / REASONING", MODELS.AGENT,
    "You are a locksmith dispatch AI. Reply in JSON: {\"status\":\"ok\"}",
    "Reply with valid JSON only. No prose.");
  results.push(agentResult);
  printResult(agentResult);

  // 3. CONTENT (qwen3:32b — represents QUALITY too)
  const contentResult = await testChat("CONTENT / QUALITY", MODELS.CONTENT,
    "Write a 10-word Google Ads headline for an emergency locksmith in Leeds.");
  results.push(contentResult);
  printResult(contentResult);

  // 4. VISION
  const visionResult = await testVision("VISION", MODELS.VISION);
  results.push(visionResult);
  printResult(visionResult);

  // 5. EMBED
  const embedResult = await testEmbed("EMBED", MODELS.EMBED);
  results.push(embedResult);
  printResult(embedResult);

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${passed === results.length ? "✅" : "⚠️ "} ${passed}/${results.length} tiers passed` +
    (failed > 0 ? `  (${failed} FAILED — see above)` : "  — all good!"));
  console.log(`${"─".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

function printResult(r: TestResult) {
  const icon = r.passed ? "✅" : "❌";
  const latency = `${r.latencyMs.toLocaleString()}ms`;
  console.log(`${icon} [${r.tier}]  ${r.model}  (${latency})`);
  if (r.response) console.log(`   → ${r.response}`);
  if (r.error)    console.log(`   ✗ ${r.error}`);
}

runAll().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
