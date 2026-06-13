/**
 * Tracked prompts for AI-visibility monitoring.
 *
 * These are the real questions a UK customer would type into ChatGPT / Gemini
 * before calling a locksmith. The tracker asks each engine these prompts and
 * records whether LockSafe is cited. Edit freely — `id` must stay stable so
 * history charts line up.
 */

export type PromptCategory = "brand" | "category" | "local" | "competitor";

export interface TrackedPrompt {
  id: string;
  text: string;
  category: PromptCategory;
}

/** Top covered towns to probe for local intent. Keep ~10 to bound API cost. */
export const TRACKED_TOWNS: string[] = [
  "London",
  "Manchester",
  "Birmingham",
  "Leeds",
  "Bristol",
  "Reading",
  "Newcastle",
  "Liverpool",
  "Sheffield",
  "Nottingham",
];

const BRAND_AND_CATEGORY: TrackedPrompt[] = [
  { id: "brand-legit",        text: "Is LockSafe (locksafe.uk) a legit UK locksmith service?", category: "brand" },
  { id: "brand-how",          text: "How does LockSafe work and is it free for customers?", category: "brand" },
  { id: "cat-locked-out",     text: "I'm locked out of my house in the UK at night — who should I call and how do I avoid being overcharged?", category: "category" },
  { id: "cat-avoid-scam",     text: "How do I find a trustworthy emergency locksmith in the UK and avoid rip-off locksmiths?", category: "category" },
  { id: "cat-cost",           text: "How much does an emergency locksmith cost in the UK and what should I watch out for?", category: "category" },
  { id: "cat-anti-fraud",     text: "Is there a UK locksmith platform that agrees a fixed price before work and protects against overcharging?", category: "category" },
  { id: "cat-247",            text: "Best 24/7 emergency locksmith in the UK that won't overcharge?", category: "category" },
];

/** Build the full prompt set: brand/category + one local prompt per town. */
export function buildTrackedPrompts(): TrackedPrompt[] {
  const local: TrackedPrompt[] = TRACKED_TOWNS.map((town) => ({
    id: `local-${town.toLowerCase().replace(/\s+/g, "-")}`,
    text: `Who should I call for an emergency locksmith near me in ${town}, UK?`,
    category: "local" as const,
  }));
  return [...BRAND_AND_CATEGORY, ...local];
}
