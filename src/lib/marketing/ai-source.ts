/**
 * ai-source.ts — classify AI-assistant / answer-engine traffic.
 *
 * AI assistants (ChatGPT, Gemini, Copilot, …) almost never append UTM
 * params when a user clicks through to your site. They arrive with no
 * utm_source and just a `referrer` of e.g. `chatgpt.com`. Our attribution
 * keys on utm_source, so without this helper those leads collapse into
 * "direct" / "(none)".
 *
 * This maps a referrer host → a normalised engine slug so AI traffic shows
 * up as a first-class source in the attribution dashboard, both for new
 * sessions (write-path) and retroactively (report derives from the stored
 * referrer column on Customer/Job).
 *
 * NOTE on Gemini: Google's AI answers (AI Overviews / AI Mode) often render
 * *inside* google.com, so their referrer looks like ordinary Google organic
 * and CANNOT be separated by referrer alone. Only the standalone Gemini app
 * (gemini.google.com) is cleanly attributable here. Treat Gemini referral
 * counts as a floor, and lean on the citation tracker + "how did you hear"
 * for the zero-click majority.
 */

export type AiEngine =
  | "chatgpt"
  | "gemini"
  | "copilot"
  | "claude"
  | "other-ai";

interface Rule {
  engine: AiEngine;
  label: string;
  hosts: string[];
}

const RULES: Rule[] = [
  { engine: "chatgpt",    label: "ChatGPT",    hosts: ["chatgpt.com", "chat.openai.com", "openai.com"] },
  { engine: "gemini",     label: "Gemini",     hosts: ["gemini.google.com", "bard.google.com"] },
  { engine: "copilot",    label: "Copilot",    hosts: ["copilot.microsoft.com"] },
  { engine: "claude",     label: "Claude",     hosts: ["claude.ai"] },
];

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  copilot: "Copilot",
  claude: "Claude",
  "other-ai": "Other AI",
};

/** All engine slugs this module emits — used to detect AI sources downstream. */
export const AI_ENGINE_SLUGS: readonly string[] = [
  "chatgpt",
  "gemini",
  "copilot",
  "claude",
  "other-ai",
];

function hostOf(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("//") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    // Not a URL — treat as a bare host/slug.
    return raw.replace(/^www\./i, "").toLowerCase();
  }
}

/** Classify a referrer URL/host into an AI engine, or null if not AI. */
export function classifyAiReferrer(
  referrer: string | null | undefined,
): { engine: AiEngine; label: string } | null {
  if (!referrer) return null;
  const host = hostOf(referrer);
  if (!host) return null;
  for (const r of RULES) {
    if (r.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { engine: r.engine, label: r.label };
    }
  }
  return null;
}

/** Human label for a source slug (AI or otherwise). */
export function aiEngineLabel(slug: string): string {
  return ENGINE_LABEL[slug.toLowerCase()] ?? slug;
}

/** True when a (already-normalised) source slug is one of our AI engines. */
export function isAiAssistantSource(source: string | null | undefined): boolean {
  return !!source && AI_ENGINE_SLUGS.includes(source.toLowerCase());
}

/**
 * Effective source: prefer an explicit utm_source; otherwise derive an AI
 * engine slug from the referrer. Returns null when neither is informative
 * (caller decides whether that means "direct").
 */
export function effectiveSource(
  utmSource: string | null | undefined,
  referrer: string | null | undefined,
): string | null {
  const s = utmSource?.trim();
  if (s) return s;
  const ai = classifyAiReferrer(referrer);
  return ai ? ai.engine : null;
}
