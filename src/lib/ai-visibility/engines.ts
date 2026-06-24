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
 *   OPENAI_API_KEY            — ChatGPT (already configured in prod)
 *   GEMINI_API_KEY            — Gemini
 *   AZURE_AI_FOUNDRY_ENDPOINT — Copilot / Microsoft Bing-grounded answers
 *   AZURE_AI_FOUNDRY_API_KEY  —   "
 *   AI_VIS_COPILOT_AGENT_ID   —   "  (pre-created agent with the Bing tool)
 *
 * "Copilot" here = Azure AI Foundry's "Grounding with Bing Search" — the same
 * GPT-grounded-on-Bing stack Microsoft Copilot uses. There is no consumer
 * Copilot API; this is Microsoft's supported path since the standalone Bing
 * Search API was retired (Aug 2025). It needs a paid Azure subscription, a
 * provisioned Grounding-with-Bing resource, and an agent — so it stays
 * "skipped" until those env vars are set.
 */

export type VisibilityEngine = "chatgpt" | "gemini" | "copilot";

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

// Retry transient throttling (HTTP 429) and 5xx with exponential backoff +
// jitter, honouring Retry-After when present. A fresh abort timeout is created
// per attempt (an AbortSignal can only fire once). Network/abort errors retry
// too. This is what stops grounded calls (esp. Gemini) showing as "err" when
// they were really just rate-limited mid-run.
async function fetchWithRetry(
  url: string,
  init: Omit<RequestInit, "signal">,
  label: string,
  retries = 3,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0
          ? Math.min(ra * 1000, 8000)
          : Math.min(700 * 2 ** attempt, 8000) + Math.random() * 400;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) =>
          setTimeout(r, Math.min(700 * 2 ** attempt, 8000) + Math.random() * 400),
        );
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error(`${label}: retries exhausted`);
}

// ── ChatGPT (OpenAI Responses API + web_search) ──────────────────────────────
async function queryChatGPT(prompt: string): Promise<EngineResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new SkippedEngineError("chatgpt", "OPENAI_API_KEY not set");

  const model = process.env.AI_VIS_OPENAI_MODEL || "gpt-4o";
  const res = await fetchWithRetry("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: prompt,
    }),
  }, "OpenAI");
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

  const model = process.env.AI_VIS_GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
    "Gemini",
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

// ── Copilot (Azure AI Foundry — Grounding with Bing Search) ──────────────────
// Microsoft's supported path for Bing-grounded answers with citations. It uses
// the Agents (Assistants-compatible) API: open a thread+run on a pre-created
// agent that has the Bing tool, poll until the run completes, then read the
// assistant message + its url_citation annotations. Env-gated; api-version is
// configurable so it tracks whatever the Foundry portal issues.
async function queryCopilot(prompt: string): Promise<EngineResult> {
  const endpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT?.replace(/\/+$/, "");
  const key = process.env.AZURE_AI_FOUNDRY_API_KEY;
  const agentId = process.env.AI_VIS_COPILOT_AGENT_ID;
  if (!endpoint || !key || !agentId) {
    throw new SkippedEngineError(
      "copilot",
      "AZURE_AI_FOUNDRY_ENDPOINT / AZURE_AI_FOUNDRY_API_KEY / AI_VIS_COPILOT_AGENT_ID not set",
    );
  }
  const apiVersion = process.env.AI_VIS_AZURE_API_VERSION || "2025-05-01";
  const headers = { "api-key": key, "Content-Type": "application/json" };
  const qs = `api-version=${encodeURIComponent(apiVersion)}`;

  // 1) Create a thread and start a run on the Bing-grounded agent.
  const startRes = await fetch(`${endpoint}/threads/runs?${qs}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      assistant_id: agentId,
      thread: { messages: [{ role: "user", content: prompt }] },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!startRes.ok) {
    throw new Error(`Copilot(start) ${startRes.status}: ${(await startRes.text()).slice(0, 200)}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run: any = await startRes.json();
  const threadId: string = run.thread_id;
  const runId: string = run.id;
  if (!threadId || !runId) throw new Error("Copilot: missing thread_id/run id in run response");

  // 2) Poll the run to completion (overall budget bounded by TIMEOUT_MS).
  const deadline = Date.now() + TIMEOUT_MS;
  let status: string = run.status;
  while (status === "queued" || status === "in_progress" || status === "requires_action") {
    if (Date.now() > deadline) throw new Error("Copilot: run timed out");
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(`${endpoint}/threads/${threadId}/runs/${runId}?${qs}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!pollRes.ok) {
      throw new Error(`Copilot(poll) ${pollRes.status}: ${(await pollRes.text()).slice(0, 200)}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const polled: any = await pollRes.json();
    status = polled.status;
  }
  if (status !== "completed") throw new Error(`Copilot: run ended as "${status}"`);

  // 3) Read the assistant message + its url_citation annotations.
  const msgRes = await fetch(`${endpoint}/threads/${threadId}/messages?${qs}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!msgRes.ok) {
    throw new Error(`Copilot(messages) ${msgRes.status}: ${(await msgRes.text()).slice(0, 200)}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any = await msgRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assistantMsg = (msgs.data ?? []).find((m: any) => m.role === "assistant");

  let answer = "";
  const urls: string[] = [];
  for (const part of assistantMsg?.content ?? []) {
    const t = part?.text;
    if (typeof t?.value === "string") answer += (answer ? " " : "") + t.value;
    for (const a of t?.annotations ?? []) {
      const u = a?.url_citation?.url ?? a?.url ?? a?.uri;
      if (typeof u === "string") urls.push(u);
    }
  }
  return { answer: answer.trim(), citedUrls: dedupeUrls(urls) };
}

export function queryEngine(engine: VisibilityEngine, prompt: string): Promise<EngineResult> {
  switch (engine) {
    case "chatgpt": return queryChatGPT(prompt);
    case "gemini":  return queryGemini(prompt);
    case "copilot": return queryCopilot(prompt);
  }
}
