/**
 * Two-gate QA approval agent for poster background assets.
 *
 *   Gate 1 — fast reject filter (qwen2.5vl:7b): catches only GROSS defects
 *            (garbled text, broken anatomy, melted/floating objects, blur).
 *            Passes when unsure — the next gate is stricter.
 *   Gate 2 — full approver (qwen3-vl:32b): the strict 20-item LockSafeUK rubric,
 *            run ONLY on Gate-1 survivors. ACCEPT only if all 20 pass.
 *
 * Fail-safe: if a model is unreachable (e.g. Gate 2 not downloaded yet), the
 * verdict is SKIPPED and the asset still goes to human review — QA never blocks
 * generation, it only adds a recommendation (shadow mode) or auto-approves
 * (when LOCKSAFE_QA_AUTOAPPROVE=true).
 */

const OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const GATE1_MODEL = process.env.LOCKSAFE_QA_GATE1_MODEL ?? "qwen2.5vl:7b";
const GATE2_MODEL = process.env.LOCKSAFE_QA_GATE2_MODEL ?? "qwen3-vl:32b";

const GATE1_PROMPT = `You are a first-pass image filter for LockSafeUK hero images. Only catch GROSS, obvious defects. Do NOT make subtle aesthetic or brand judgments — that happens later.

Reject the image if ANY of these are clearly true:
- Visibly garbled, melted, or nonsensical text/lettering anywhere.
- Obvious anatomy errors (wrong number of fingers, warped hands/faces).
- Duplicated, melted, or floating objects, or broken perspective/shadows.
- Heavy compression artifacts or an obviously low-resolution/blurry image.

If none are clearly true, PASS it on. When unsure, PASS (the next stage is stricter).

Output exactly two lines:
DECISION: PASS or REJECT
REASON: one short sentence.`;

const GATE2_PROMPT = `You are the QA approver for an AI-generated hero image for LockSafeUK, a UK locksmith and home-security service. Evaluate the image against all 20 items below.

STRICT RULES:
- Evaluate every item, 1 through 20. Do NOT merge, skip, reorder, or renumber them.
- Output exactly 20 result lines, one per item, in order.
- For each item output: "<number>. PASS" or "<number>. FAIL — <one-line reason>".
- Do not invent criteria that are not listed.

BRAND & MOOD
1. Palette is on-brand navy + amber.
2. There is a clean, low-busyness dark area suitable for overlaying a headline.
3. Mood is premium and trustworthy — not cheap, not scary.
4. Subject is genuinely about locksmithing / home security / anti-scam.

TRUST POSITIONING
5. Communicates safety and resolution (secure home, job done, calm professional) — NOT the threat itself. No burglars, crowbars, broken glass, or fear imagery.
6. Implies legitimacy/vetting (tidy, professional). No rogue-trader or dodgy connotations.
7. Avoids cheap stock clichés: padlock-on-glowing-circuitry, hooded hacker, floating holographic shields.

UK AUTHENTICITY
8. Hardware reads British: euro-cylinder locks, Yale-style nightlatches, uPVC/composite doors — NOT American deadbolts or US-style doors.
9. Any exterior/home/street looks like a UK setting, not generic US suburbia.

REALISM & AI-FAILURE CHECKS
10. People (if any) are photorealistic with no uncanny features. No people is acceptable.
11. Hands and fingers are anatomically correct — especially hands gripping locks or tools.
12. Lock and key mechanisms are plausible: real keyway and cylinder, no impossible geometry.
13. Tools look like real locksmith tools, not invented gadgets.
14. No duplicated, melted, or floating objects; shadows and perspective are consistent; surfaces are not plasticky or over-smoothed.

TEXT & MARKS
15. No READABLE text, words, letters, numbers, or watermarks anywhere, and no garbled/fake lettering on badges, keypads, vans, or signage — inspect small details closely. (Incidental NON-TEXT physical marks — key cuts, minor engravings, scratches, wear — are ACCEPTABLE; only FAIL for actual readable text or lettering.)
16. No recognisable real trademarked brand logo or wordmark (Yale, Chubb, Banham, ADT) and no recognisable real individuals. (Tiny ambiguous emblems with no readable brand name are acceptable.)

COMPOSITION & TECHNICAL
17. Correct aspect ratio for a web hero, and the subject + headline space survive a mobile centre-crop.
18. Clear focal point with a defined safe zone for a CTA button/logo.
19. High resolution and sharp — no compression artifacts or soft, mushy detail.
20. Overlaid headline text would be readable against the image (sufficient contrast in the copy zone).

After the 20 lines, output:
VERDICT: ACCEPT (only if all 20 are PASS) or REJECT
SUMMARY: one sentence.`;

async function askVision(model: string, prompt: string, imageB64: string, timeoutMs: number): Promise<string> {
  const r = await fetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, images: [imageB64], stream: false, options: { temperature: 0 } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`${model} HTTP ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const d = (await r.json()) as { response?: string };
  return (d.response ?? "").trim();
}

export interface QaResult {
  gate1Pass: boolean;
  gate1Reason: string;
  verdict: "ACCEPT" | "REJECT" | "SKIPPED";
  report: string;
  model: string;
}

/** Run the two-gate QA on an image buffer. Never throws. */
export async function runPosterQa(image: Buffer): Promise<QaResult> {
  const b64 = image.toString("base64");

  // Gate 1 — fast filter. On error, fail OPEN (pass) so QA never blocks.
  let gate1Pass = true;
  let gate1Reason = "passed";
  try {
    const g1 = await askVision(GATE1_MODEL, GATE1_PROMPT, b64, 60_000);
    gate1Pass = !/DECISION:\s*REJECT/i.test(g1);
    gate1Reason = (g1.match(/REASON:\s*(.+)/i)?.[1] ?? (gate1Pass ? "passed" : "rejected")).trim().slice(0, 180);
  } catch (err) {
    gate1Reason = `gate1 error (passed open): ${err instanceof Error ? err.message : String(err)}`;
  }
  if (!gate1Pass) {
    return { gate1Pass: false, gate1Reason, verdict: "REJECT", report: "Rejected at Gate 1 (gross defect).", model: GATE1_MODEL };
  }

  // Gate 2 — full rubric. On error (e.g. model not installed), SKIPPED → human review.
  try {
    const g2 = await askVision(GATE2_MODEL, GATE2_PROMPT, b64, 180_000);
    const verdict: "ACCEPT" | "REJECT" = /VERDICT:\s*ACCEPT/i.test(g2) ? "ACCEPT" : "REJECT";
    return { gate1Pass: true, gate1Reason, verdict, report: g2.slice(0, 4000), model: GATE2_MODEL };
  } catch (err) {
    return {
      gate1Pass: true,
      gate1Reason,
      verdict: "SKIPPED",
      report: `Gate 2 unavailable: ${err instanceof Error ? err.message : String(err)}`,
      model: GATE2_MODEL,
    };
  }
}
