/**
 * engines.ts — adapters that ask each AI engine a prompt with live web access
 * and return the answer text + the source URLs it cited.
 *
 * Each adapter:
 *   • throws SkippedEngineError when its API key isn't configured (the cron
 *     records it as "skipped" instead of failing the whole run);
 *   • returns { answer, citedUrls } on success;
 *   • lets real network/API errors throw (recorded as "error").
 *
 * Keys (set on Vercel):
 *   OPENAI_API_KEY      — ChatGPT (already configured in prod)
 *   GEMINI_API_KEY      — Gemini
 *   PERPLEXITY_API_KEY  — Perplexity (optional canary)
 */

export type VisibilityEngine = "chatgpt" | "gemini" | "perplexity";

export interface EngineResult {
  answer: string;
  citedUrls: string[];
}

export class SkippedEngineError extends Error {
  constructor(public engine: VisibilityEngine, reason: string) {
    super(reason);
    this.name = "SkippedEngineError";
  }
}

const TIMEOUT_MS = 30_000;

function dedupeUrls(urls: (string | null | undefined)[]): string[] {
  return Array.from(
    new Set(urls.filter((u): u is string => typeof u === "string" && u.length > 0)),
  );
}

// ── ChatGPT (OpenAI Responses API + web_search) ──────────────────────────────
async function queryChatGPT(prompt: string): Promise<EngineResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new SkippedEngineError("chatgpt", "OPENAI_API_KEY not set");

  const model = process.env.AI_VIS_OPENAI_MODEL || "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  let answer = typeof data.output_text === "string" ? data.output_text : "";
  const urls: string[] = [];
  for (const item of data.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string" && !answer) answer = c.text;
      for (const a of c.annotations ?? []) {
        if (a?.url) urls.push(a.url);
      }
    }
  }
  return { answer, citedUrls: dedupeUrls(urls) };
}

// ── Gemini (generativelanguage API + google_search grounding) ────────────────
async function queryGemini(prompt: string): Promise<EngineResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new SkippedEngineError("gemini", "GEMINI_API_KEY not set");

  const model = process.env.AI_VIS_GEMINI_MODEL || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const cand = data.candidates?.[0];
  const answer = (cand?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join(" ")
    .trim();
  const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
  const urls = chunks.map((c: { web?: { uri?: string } }) => c.web?.uri);
  return { answer, citedUrls: dedupeUrls(urls) };
}

// ── Perplexity (chat completions, returns citations) ─────────────────────────
async function queryPerplexity(prompt: string): Promise<EngineResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new SkippedEngineError("perplexity", "PERPLEXITY_API_KEY not set");

  const model = process.env.AI_VIS_PERPLEXITY_MODEL || "sonar";
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${(await res.text()).slice(0, 200)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const answer = data.choices?.[0]?.message?.content ?? "";
  const urls: string[] = Array.isArray(data.citations)
    ? data.citations
    : (data.search_results ?? []).map((s: { url?: string }) => s.url);
  return { answer, citedUrls: dedupeUrls(urls) };
}

export function queryEngine(engine: VisibilityEngine, prompt: string): Promise<EngineResult> {
  switch (engine) {
    case "chatgpt":    return queryChatGPT(prompt);
    case "gemini":     return queryGemini(prompt);
    case "perplexity": return queryPerplexity(prompt);
  }
}
