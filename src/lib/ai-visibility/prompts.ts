/**
 * Tracked prompts for AI-visibility monitoring.
 *
 * These are the real questions a UK customer would type into ChatGPT / Gemini
 * before calling a locksmith. The tracker asks each engine these prompts and
 * records whether LockSafe is cited. Edit freely — `id` must stay stable so
 * history charts line up.
 */

export type PromptCategory = "brand" | "category" | "local" | "service" | "competitor";

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

// The highest-value / most-expensive locksmith search intents (emergency
// lockout + "near me" are the priciest, ~£15–25/click; then the core
// services). Phrased as the questions a real person asks an AI assistant.
// id → target keyword in the comment.
const SERVICE_HEAD_TERMS: TrackedPrompt[] = [
  { id: "svc-emergency-near-me", category: "service", text: "I need an emergency locksmith near me right now in the UK — who should I call?" },              // "emergency locksmith near me"
  { id: "svc-locksmith-near-me",  category: "service", text: "Can you recommend a good, trustworthy locksmith near me in the UK?" },                          // "locksmith near me"
  { id: "svc-24h",                category: "service", text: "Is there a 24 hour locksmith near me I can call in the middle of the night in the UK?" },        // "24 hour locksmith near me"
  { id: "svc-car-key",            category: "service", text: "I've lost my car keys — who can replace a car key near me in the UK and how much does it cost?" }, // "car key replacement"
  { id: "svc-lock-change",        category: "service", text: "I need to change the locks on my house in the UK — who should I use and what should it cost?" },  // "lock change / change locks"
  { id: "svc-upvc",               category: "service", text: "My uPVC front door won't lock properly — who can repair or replace the lock in the UK?" },        // "uPVC door lock repair"
  { id: "svc-burglary",           category: "service", text: "Someone broke into my home and damaged the door lock — who can repair it urgently in the UK?" },  // "burglary repair / break-in"
  { id: "svc-commercial",         category: "service", text: "I need a commercial locksmith for my business premises in the UK — who's recommended?" },         // "commercial locksmith"
];

/** Build the full prompt set: brand/category + service head terms + per-town local. */
export function buildTrackedPrompts(): TrackedPrompt[] {
  const local: TrackedPrompt[] = TRACKED_TOWNS.map((town) => ({
    id: `local-${town.toLowerCase().replace(/\s+/g, "-")}`,
    text: `Who should I call for an emergency locksmith near me in ${town}, UK?`,
    category: "local" as const,
  }));
  return [...BRAND_AND_CATEGORY, ...SERVICE_HEAD_TERMS, ...local];
}
