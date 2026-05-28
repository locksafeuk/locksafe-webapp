#!/usr/bin/env tsx
/**
 * Real integration test — Creatomate + D-ID with genuine LockSafe brand content.
 *
 * Run:
 *   npx tsx --env-file .env.agent-runner scripts/test-video-gen.ts
 */

import { generateSocialVideo }  from "@/lib/creatomate";
import { generateTalkingVideo } from "@/lib/d-id";

const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const RESET = "\x1b[0m";

const log  = (m: string) => console.log(`${CYAN}[test]${RESET} ${m}`);
const ok   = (m: string) => console.log(`${GREEN}${BOLD}✅  ${m}${RESET}`);
const fail = (m: string) => console.log(`${RED}${BOLD}❌  ${m}${RESET}`);
const dim  = (m: string) => console.log(`${DIM}     ${m}${RESET}`);

// ── Creatomate: trust-signals pillar ────────────────────────────────────────
// Purple gradient. Vertical 9:16 for Instagram Reels / TikTok.
// Short punchy headline — the only UK platform that prevents price scams.
const CREATOMATE_TEST = {
  headline:        "The ONLY UK locksmith platform that prevents price scams.",
  subtext:         "DBS-checked engineers. Upfront pricing. Legally-binding job report. Available 24/7.",
  cta:             "locksafe.uk  ·  0204 577 1989",
  pillar:          "trust-signals",
  format:          "vertical" as const,
  durationSeconds: 15,
};

// ── D-ID: success-stories pillar ────────────────────────────────────────────
// Talking-head avatar, UK male voice en-GB-RyanNeural.
// Pillar intro is prepended automatically in buildScript() so we keep
// the body short (≤280 chars) so the full script stays under 380 chars.
const DID_TEST = {
  script: "A customer in Manchester was quoted £450 by a random locksmith online. They called LockSafe instead — our engineer arrived in 18 minutes, replaced the cylinder for £95, and left them with a signed PDF report. That's the LockSafe difference.",
  pillar: "success-stories",
};

// ── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}  LockSafe Video Generation — Real Brand Test${RESET}`);
  console.log(`${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);

  log(`Creatomate key : ${process.env.CREATOMATE_API_KEY ? `${GREEN}✓ set${RESET}` : `${RED}✗ MISSING${RESET}`}`);
  log(`D-ID key       : ${process.env.D_ID_API_KEY       ? `${GREEN}✓ set${RESET}` : `${RED}✗ MISSING${RESET}`}`);
  console.log();

  // ── 1. Creatomate ─────────────────────────────────────────────────────────
  console.log(`${BOLD}── Test 1: Creatomate (branded text overlay) ──────────────${RESET}`);
  log(`Pillar    : ${CREATOMATE_TEST.pillar}  (purple gradient)`);
  log(`Format    : 9:16 vertical — Instagram Reels / TikTok`);
  log(`Headline  : "${CREATOMATE_TEST.headline}"`);
  log(`Subtext   : "${CREATOMATE_TEST.subtext}"`);
  log(`CTA       : "${CREATOMATE_TEST.cta}"`);
  log(`Duration  : ${CREATOMATE_TEST.durationSeconds}s`);
  console.log();
  log("Submitting render to Creatomate API… (polls every 3s, up to 120s)");

  const t1 = Date.now();
  const creatomate = await generateSocialVideo(CREATOMATE_TEST);
  const elapsed1   = ((Date.now() - t1) / 1000).toFixed(1);

  if (creatomate) {
    ok(`Creatomate render complete in ${elapsed1}s`);
    dim(`Render ID : ${creatomate.renderId}`);
    dim(`Format    : ${creatomate.format}  |  Duration: ${creatomate.durationSeconds}s`);
    ok(`Video URL : ${creatomate.url}`);
  } else {
    fail(`Creatomate failed after ${elapsed1}s — check logs above`);
  }

  console.log();

  // ── 2. D-ID ───────────────────────────────────────────────────────────────
  console.log(`${BOLD}── Test 2: D-ID (talking-head avatar) ────────────────────${RESET}`);
  log(`Pillar    : ${DID_TEST.pillar}  (human-trust format)`);
  log(`Voice     : en-GB-SoniaNeural (UK female — matches presenter)`);
  log(`Script    : "${DID_TEST.script.slice(0, 80)}…"`);
  log(`(Full script with intro will be ~380 chars — approx 30s video)`);
  console.log();
  log("Submitting to D-ID API… (creates talk, polls every 3s, up to 120s)");

  const t2 = Date.now();
  const did     = await generateTalkingVideo(DID_TEST);
  const elapsed2 = ((Date.now() - t2) / 1000).toFixed(1);

  if (did) {
    ok(`D-ID render complete in ${elapsed2}s`);
    dim(`Talk ID   : ${did.talkId}`);
    ok(`Video URL : ${did.url}`);
  } else {
    fail(`D-ID failed after ${elapsed2}s — check logs above`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log();
  console.log(`${BOLD}━━━ Final Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  const cStatus = creatomate ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const dStatus = did        ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`Creatomate (text overlay)  : ${cStatus}`);
  console.log(`D-ID (talking avatar)      : ${dStatus}`);
  console.log();

  if (creatomate?.url || did?.url) {
    console.log(`${BOLD}Play videos (copy + paste into Terminal):${RESET}`);
    if (creatomate?.url) console.log(`  open "${creatomate.url}"`);
    if (did?.url)        console.log(`  open "${did.url}"`);
  }

  console.log();

  // Exit 1 if either failed so CI can catch it
  if (!creatomate || !did) process.exit(1);
}

main().catch((err) => {
  fail(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
