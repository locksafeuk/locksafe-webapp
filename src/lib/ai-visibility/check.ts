/**
 * check.ts — run the tracked prompts against the chosen engines, detect
 * whether LockSafe is cited, and persist an AiVisibilitySnapshot per
 * prompt × engine. Pure orchestration; engines + prompts live in siblings.
 */

import { prisma as _prisma } from "@/lib/db";
import { buildTrackedPrompts } from "@/lib/ai-visibility/prompts";
import {
  queryEngine,
  SkippedEngineError,
  type VisibilityEngine,
} from "@/lib/ai-visibility/engines";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const DEFAULT_ENGINES: VisibilityEngine[] = ["chatgpt", "gemini", "perplexity"];

// Competitors + directories an AI might recommend instead of LockSafe.
const COMPETITOR_NAMES = [
  "Keytek", "Timpson", "Keys4U", "LockRite", "Lockforce", "Banham",
  "Checkatrade", "Rated People", "Bark", "MyBuilder", "Yell",
];

const BRAND_RE = /locksafe/i;
const LOCKSAFE_HOST_RE = /(^|\.)locksafe\.uk$/i;

function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

/** Did the answer cite LockSafe, and at what source rank (1-based) if URL-based. */
export function detectLockSafe(answer: string, citedUrls: string[]): {
  cited: boolean;
  position: number | null;
} {
  let position: number | null = null;
  citedUrls.forEach((u, i) => {
    const h = hostOf(u);
    if (position === null && h && LOCKSAFE_HOST_RE.test(h)) position = i + 1;
  });
  const cited = position !== null || BRAND_RE.test(answer || "");
  return { cited, position };
}

export function detectCompetitors(answer: string, citedUrls: string[]): string[] {
  const hay = `${answer || ""} ${citedUrls.join(" ")}`.toLowerCase();
  return COMPETITOR_NAMES.filter((c) => hay.includes(c.toLowerCase()));
}

export interface VisibilityRunSummary {
  runAt: string;
  engines: VisibilityEngine[];
  prompts: number;
  ok: number;
  cited: number;
  skipped: number;
  errors: number;
  shareOfVoice: Record<string, { ok: number; cited: number; pct: number }>;
}

// Process one (prompt, engine) pair: query, classify, persist, return status.
async function processOne(
  prompt: { id: string; text: string; category: string },
  engine: VisibilityEngine,
  runAt: Date,
): Promise<{ engine: VisibilityEngine; status: "ok" | "skipped" | "error"; cited: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap: any = {
    runAt,
    engine,
    promptId: prompt.id,
    promptText: prompt.text,
    category: prompt.category,
    status: "ok",
    citedLockSafe: false,
    position: null,
    citedUrls: [],
    competitors: [],
    answerExcerpt: null,
    error: null,
  };
  let status: "ok" | "skipped" | "error" = "ok";
  let cited = false;
  try {
    const { answer, citedUrls } = await queryEngine(engine, prompt.text);
    const det = detectLockSafe(answer, citedUrls);
    snap.citedLockSafe = det.cited;
    snap.position = det.position;
    snap.citedUrls = citedUrls.slice(0, 12);
    snap.competitors = detectCompetitors(answer, citedUrls);
    snap.answerExcerpt = (answer || "").slice(0, 500);
    cited = det.cited;
  } catch (err) {
    if (err instanceof SkippedEngineError) {
      snap.status = "skipped";
      snap.error = err.message;
      status = "skipped";
    } else {
      snap.status = "error";
      snap.error = err instanceof Error ? err.message.slice(0, 300) : String(err);
      status = "error";
    }
  }
  try {
    await prisma.aiVisibilitySnapshot.create({ data: snap });
  } catch (e) {
    console.warn("[ai-visibility] failed to persist snapshot:", e instanceof Error ? e.message : e);
  }
  return { engine, status, cited };
}

export async function runAiVisibilityCheck(opts: {
  engines?: VisibilityEngine[];
  promptLimit?: number;
  concurrency?: number;
} = {}): Promise<VisibilityRunSummary> {
  const engines = opts.engines ?? DEFAULT_ENGINES;
  const prompts = opts.promptLimit
    ? buildTrackedPrompts().slice(0, opts.promptLimit)
    : buildTrackedPrompts();
  const runAt = new Date();

  const sov: Record<string, { ok: number; cited: number; pct: number }> = {};
  for (const e of engines) sov[e] = { ok: 0, cited: 0, pct: 0 };
  let ok = 0, cited = 0, skipped = 0, errors = 0;

  // Bounded-concurrency worker pool over every (prompt, engine) pair, so a
  // ~24-prompt run finishes well inside the function timeout even when an
  // engine call is slow (web-grounded answers take 10–20s each).
  const tasks: Array<{ prompt: (typeof prompts)[number]; engine: VisibilityEngine }> =
    prompts.flatMap((p) => engines.map((e) => ({ prompt: p, engine: e })));
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 6, tasks.length || 1));
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const t = tasks[cursor++];
      const res = await processOne(t.prompt, t.engine, runAt);
      if (res.status === "ok") {
        ok++; sov[res.engine].ok++;
        if (res.cited) { cited++; sov[res.engine].cited++; }
      } else if (res.status === "skipped") skipped++;
      else errors++;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  for (const e of engines) {
    sov[e].pct = sov[e].ok > 0 ? Number(((sov[e].cited / sov[e].ok) * 100).toFixed(1)) : 0;
  }

  return {
    runAt: runAt.toISOString(),
    engines,
    prompts: prompts.length,
    ok, cited, skipped, errors,
    shareOfVoice: sov,
  };
}
