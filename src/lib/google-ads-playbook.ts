/**
 * Self-learning Google Ads Campaign Playbook.
 *
 * The playbook is a small set of campaign-creation RULES that:
 *   1. SEED from proven launch configuration (the 2026-06-02 winning template
 *      + the Liverpool Test failure lesson).
 *   2. ARE READ by the campaign generator (`google-ads-onboarding.generateRsaCopy`)
 *      before every new campaign so the agent applies what fits.
 *   3. SELF-UPDATE from Google Ads performance: the reflection engine distils
 *      each graded WIN/LOSS on an ads-specialist campaign into a learned rule.
 *
 * CRITICAL DESIGN NOTE — why this is DB-backed (not the in-RAM AgentMemory store):
 *   `memory.getRelevantMemories` / `queryAccessibleMemories` read an in-process
 *   Map that is EMPTY at the start of every serverless/cron invocation and is
 *   never hydrated from the DB. A playbook stored only via `storeMemory` would
 *   therefore be invisible to a fresh campaign-generation process. So we read
 *   and write the `AgentMemory` table directly through Prisma. Rows still live
 *   under the `ads-specialist` agent with `category = "playbook"`, so they show
 *   up in the existing memory tooling, but persistence is guaranteed.
 */

import prisma from "@/lib/db";

export const PLAYBOOK_AGENT_NAME = "ads-specialist";
export const PLAYBOOK_CATEGORY = "playbook";

export type PlaybookSection =
  | "bid-strategy"
  | "structure"
  | "keywords"
  | "negatives"
  | "copy"
  | "landing"
  | "budget"
  | "guardrails"
  | "post-publish"
  | "learned";

export interface PlaybookRuleInput {
  /** Stable key — upserts are idempotent on this. */
  key: string;
  section: PlaybookSection;
  content: string;
  /** 0–1. Higher = surfaced first in the prompt and more durable. */
  importance: number;
  /** "seed" for the baseline template, "reflection" for learned rules. */
  source?: string;
  /** Optional extra metadata (e.g. outcome, subjectId, metric). */
  extra?: Record<string, unknown>;
}

export interface StoredPlaybookRule extends PlaybookRuleInput {
  id: string;
  source: string;
  updatedAt: Date;
}

interface PlaybookMetadata {
  playbookKey: string;
  section: PlaybookSection;
  source: string;
  scope: "shared";
  strategicCategory: "strategic";
  tags: string[];
  extra?: Record<string, unknown>;
}

// ─── Agent resolution ────────────────────────────────────────────────────────

/** Resolve the ads-specialist agent id. Returns null if the agent row is absent. */
export async function getPlaybookAgentId(): Promise<string | null> {
  const agent = await prisma.agent.findUnique({
    where: { name: PLAYBOOK_AGENT_NAME },
    select: { id: true },
  });
  return agent?.id ?? null;
}

// ─── Read ──────────────────────────────────────────────────────────────────

function parseRow(row: {
  id: string;
  content: string;
  importance: number;
  metadata: string | null;
  updatedAt: Date;
}): StoredPlaybookRule | null {
  let meta: PlaybookMetadata | null = null;
  try {
    meta = row.metadata ? (JSON.parse(row.metadata) as PlaybookMetadata) : null;
  } catch {
    meta = null;
  }
  if (!meta?.playbookKey) return null;
  return {
    id: row.id,
    key: meta.playbookKey,
    section: meta.section,
    content: row.content,
    importance: row.importance,
    source: meta.source ?? "unknown",
    extra: meta.extra,
    updatedAt: row.updatedAt,
  };
}

/** Read every playbook rule, highest-importance first. DB-backed. */
export async function getPlaybookRules(): Promise<StoredPlaybookRule[]> {
  const agentId = await getPlaybookAgentId();
  if (!agentId) return [];
  const rows = await prisma.agentMemory.findMany({
    where: { agentId, category: PLAYBOOK_CATEGORY },
    select: { id: true, content: true, importance: true, metadata: true, updatedAt: true },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
  });
  return rows
    .map(parseRow)
    .filter((r): r is StoredPlaybookRule => r !== null);
}

/**
 * Render the playbook as a compact bullet block for prompt injection.
 * Returns "" when there are no rules so callers can append unconditionally.
 */
export async function renderPlaybookForPrompt(
  opts: { max?: number } = {},
): Promise<string> {
  const max = opts.max ?? 14;
  const rules = await getPlaybookRules();
  if (rules.length === 0) return "";
  const lines = rules.slice(0, max).map((r) => `• [${r.section}] ${r.content}`);
  return [
    "CAMPAIGN PLAYBOOK — accumulated rules learned from past LockSafe campaigns and their measured performance.",
    "Apply whatever is relevant to THIS campaign; these reflect what has actually worked (and failed) on the account:",
    ...lines,
  ].join("\n");
}

// ─── Write (idempotent upsert) ───────────────────────────────────────────────

/**
 * Insert or update a playbook rule, keyed by `rule.key`. Idempotent: calling
 * twice with the same key updates the existing row instead of duplicating.
 */
export async function upsertPlaybookRule(
  rule: PlaybookRuleInput,
): Promise<{ created: boolean } | null> {
  const agentId = await getPlaybookAgentId();
  if (!agentId) {
    console.warn(`[playbook] agent "${PLAYBOOK_AGENT_NAME}" not found — rule "${rule.key}" not persisted`);
    return null;
  }

  const metadata: PlaybookMetadata = {
    playbookKey: rule.key,
    section: rule.section,
    source: rule.source ?? "seed",
    scope: "shared",
    strategicCategory: "strategic",
    tags: ["playbook", rule.section, rule.source ?? "seed"],
    extra: rule.extra,
  };

  // Find an existing row with the same playbookKey (metadata is a JSON string,
  // so we match in code — row count is tiny).
  const existing = await prisma.agentMemory.findMany({
    where: { agentId, category: PLAYBOOK_CATEGORY },
    select: { id: true, metadata: true },
  });
  const match = existing.find((row) => {
    try {
      return row.metadata && (JSON.parse(row.metadata) as PlaybookMetadata).playbookKey === rule.key;
    } catch {
      return false;
    }
  });

  const data = {
    type: "long" as const, // playbook rules are durable
    category: PLAYBOOK_CATEGORY,
    content: rule.content,
    metadata: JSON.stringify(metadata),
    importance: Math.max(0, Math.min(1, rule.importance)),
    expiresAt: null,
  };

  if (match) {
    await prisma.agentMemory.update({ where: { id: match.id }, data });
    return { created: false };
  }
  await prisma.agentMemory.create({ data: { agentId, ...data } });
  return { created: true };
}

// ─── Seed (baseline template) ────────────────────────────────────────────────

/**
 * The proven launch configuration, derived from the 4 campaigns published
 * 2026-06-02 (all launched SERVING with zero disapprovals) and the Liverpool
 * Test failure (Manual CPC: £116.54 spent, 20 clicks, 0 conversions).
 */
export const SEED_PLAYBOOK_RULES: PlaybookRuleInput[] = [
  {
    key: "bid-strategy",
    section: "bid-strategy",
    importance: 0.98,
    content:
      "Use MAXIMIZE_CONVERSIONS (a conversion-based smart-bidding strategy) for new Search campaigns. NEVER use Manual CPC / clicks-focused bidding — the account tracks conversions. Evidence: 'Liverpool Test' ran Manual CPC and spent £116.54 for 20 clicks and 0 conversions.",
  },
  {
    key: "channel-language",
    section: "structure",
    importance: 0.8,
    content: "Channel = SEARCH. Language target = English (geo-constant 1000). One ad group, one RSA, one city landing page per campaign.",
  },
  {
    key: "rsa-structure",
    section: "copy",
    importance: 0.85,
    content:
      "RSA: 14 distinct headlines (≤30 chars) and 4 descriptions (≤90 chars). Do not pin headlines — let Google rotate the full set.",
  },
  {
    key: "keyword-mix",
    section: "keywords",
    importance: 0.85,
    content:
      "~50 keywords across match types: EXACT for high-intent lockout/emergency terms; PHRASE for product/situational (uPVC, anti-snap, composite, out-of-hours, burglary); BROAD only for trust terms (vetted/insured/anti-fraud/DBS-checked locksmith).",
  },
  {
    key: "negatives",
    section: "negatives",
    importance: 0.9,
    content:
      "Attach the full shared negative list (~128) blocking: careers/training, tools/software, DIY/lock-picking, automotive, alarms/CCTV, non-door locks, competitor brands, and negative-sentiment terms.",
  },
  {
    key: "landing-page",
    section: "landing",
    importance: 0.85,
    content:
      "Point each campaign at its city/district landing page (/locksmith-city/<city> or /locksmith-in/<district>). Confirm the page returns HTTP 200 before publishing.",
  },
  {
    key: "budget-tiers",
    section: "budget",
    importance: 0.7,
    content:
      "Daily budget scales with market size. Observed launch tiers: London £50, Midlands/Yorkshire £25, North East £20 (~£120/day combined). Start small for narrow geos.",
  },
  {
    key: "content-guardrails",
    section: "guardrails",
    importance: 0.95,
    content:
      "NEVER claim 'no call-out fee' / 'no surprise fees' and NEVER fabricate review counts (both are actively guarded). Prefer factual framing: 'Full price agreed upfront', 'See the quote before you book'. Treat 'No hidden extras' as the first phrase to revise if a pricing-claim disapproval appears.",
  },
  {
    key: "post-publish",
    section: "post-publish",
    importance: 0.8,
    content:
      "After publishing, confirm live status = SERVING/ENABLED and rejectedReason/publishError are null. Do NOT pause a campaign right after launch — the WA1/Liverpool draft was paused 26 minutes in and never served.",
  },
];

/** Seed the baseline rules. Idempotent — safe to run repeatedly. */
export async function seedPlaybook(): Promise<{ created: number; updated: number; skipped: number }> {
  const agentId = await getPlaybookAgentId();
  if (!agentId) {
    console.warn(`[playbook] cannot seed — agent "${PLAYBOOK_AGENT_NAME}" not found. Run agent initialization first.`);
    return { created: 0, updated: 0, skipped: SEED_PLAYBOOK_RULES.length };
  }
  let created = 0;
  let updated = 0;
  for (const rule of SEED_PLAYBOOK_RULES) {
    const res = await upsertPlaybookRule({ ...rule, source: "seed" });
    if (res?.created) created++;
    else if (res) updated++;
  }
  return { created, updated, skipped: 0 };
}

// ─── Self-update from reflection ─────────────────────────────────────────────

const PLAYBOOK_RELEVANT_SUBJECTS = new Set(["draft", "suggestion"]);

/**
 * Distil a graded reflection into the playbook. Called by the reflection engine
 * after it records a WIN/LOSS. No-ops for anything that isn't an ads-specialist
 * campaign outcome, so it is always safe to call.
 *
 * Keyed by subjectId, so each campaign contributes at most ONE evolving rule
 * (re-grading updates it rather than appending) — the playbook can't balloon.
 */
export async function applyReflectionToPlaybook(input: {
  agentName: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  outcome: "WIN" | "LOSS" | "INCONCLUSIVE" | "NEUTRAL";
  metric: string;
  lessons: string[];
}): Promise<void> {
  if (input.agentName !== PLAYBOOK_AGENT_NAME) return;
  if (!PLAYBOOK_RELEVANT_SUBJECTS.has(input.subjectType)) return;
  if (input.outcome !== "WIN" && input.outcome !== "LOSS") return;
  if (input.lessons.length === 0) return;

  const lesson = input.lessons.join("; ");
  const content = `[${input.outcome} · ${input.metric} · ${input.subjectLabel}] ${lesson}`;

  try {
    await upsertPlaybookRule({
      key: `learned:${input.subjectType}:${input.subjectId}`,
      section: "learned",
      importance: input.outcome === "LOSS" ? 0.88 : 0.78,
      content,
      source: "reflection",
      extra: {
        outcome: input.outcome,
        metric: input.metric,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    });
  } catch (err) {
    console.warn("[playbook] applyReflectionToPlaybook failed:", err instanceof Error ? err.message : err);
  }
}

// ─── Markdown mirror ─────────────────────────────────────────────────────────

/** Render the current playbook as Markdown (human-readable mirror). */
export async function renderPlaybookMarkdown(): Promise<string> {
  const rules = await getPlaybookRules();
  const now = new Date().toISOString().slice(0, 10);
  const bySection = new Map<string, StoredPlaybookRule[]>();
  for (const r of rules) {
    if (!bySection.has(r.section)) bySection.set(r.section, []);
    bySection.get(r.section)!.push(r);
  }
  const order: PlaybookSection[] = [
    "bid-strategy", "structure", "copy", "keywords", "negatives",
    "landing", "budget", "guardrails", "post-publish", "learned",
  ];
  const parts: string[] = [
    "# LockSafe Google Ads — Campaign Playbook (live)",
    "",
    `_Auto-generated mirror of the self-learning playbook stored in AgentMemory (agent: ${PLAYBOOK_AGENT_NAME}). Last exported ${now}. ${rules.length} rules._`,
    "",
    "This file is rewritten from the database. The campaign generator reads these rules before building every new campaign, and the reflection engine appends/updates the **learned** rules from measured Google Ads performance.",
    "",
  ];
  for (const section of order) {
    const items = bySection.get(section);
    if (!items || items.length === 0) continue;
    parts.push(`## ${section}`, "");
    for (const r of items) {
      parts.push(`- ${r.content}  _(importance ${r.importance.toFixed(2)}, source: ${r.source})_`);
    }
    parts.push("");
  }
  return parts.join("\n");
}

/**
 * Write the Markdown mirror to disk. Best-effort: on read-only/serverless
 * filesystems this will fail gracefully and the caller can use the returned
 * string instead. Returns the markdown content regardless.
 */
export async function exportPlaybookToMarkdown(filePath?: string): Promise<{ markdown: string; written: boolean; path?: string }> {
  const markdown = await renderPlaybookMarkdown();
  const target = filePath ?? `${process.cwd()}/google-ads-campaign-playbook.live.md`;
  try {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(target, markdown, "utf8");
    return { markdown, written: true, path: target };
  } catch (err) {
    console.warn("[playbook] markdown export to disk failed (returning content only):", err instanceof Error ? err.message : err);
    return { markdown, written: false };
  }
}
