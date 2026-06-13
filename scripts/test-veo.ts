/**
 * One-shot smoke test for Veo b-roll generation (run ON the Mac runner).
 *
 *   cd ~/Locksafe\ Project/locksafe-webapp
 *   npx tsx scripts/test-veo.ts
 *
 * Generates ONE Veo-Lite b-roll clip (~£0.20–0.30) to validate GEMINI_API_KEY +
 * the REST flow + download, and prints the file size, duration and estimated
 * cost. Does NOT touch the budget ledger or upload anything. Safe, cheap check
 * before relying on Veo in the live pipeline.
 */

import "dotenv/config";
import path from "node:path";
import { tmpdir } from "node:os";
import { statSync } from "node:fs";
import { isVeoConfigured, brollPrompt, generateBrollClip, veoModel } from "@/lib/veo";
import { veoSpendStatus } from "@/lib/veo-budget";

async function main() {
  if (!isVeoConfigured()) {
    console.error("❌ GEMINI_API_KEY not set in .env — add it to enable Veo b-roll.");
    process.exit(1);
  }
  const { model, costPerSecondUsd } = veoModel();
  const status = await veoSpendStatus();
  console.log(`🎥 Model: ${model}  ($${costPerSecondUsd}/s)`);
  console.log(`💷 This month so far: $${status.spentUsd.toFixed(2)} / $${status.capUsd.toFixed(0)} (${status.clips} clips)`);

  const outPath = path.join(tmpdir(), `veo-smoketest-${Date.now()}.mp4`);
  const prompt = brollPrompt("a vetted UK locksmith calmly fitting a secure lock on a Victorian front door at dusk");
  console.log(`\n📝 Prompt: ${prompt}\n⏳ Generating (this can take 1–3 minutes)…`);

  const t0 = Date.now();
  const clip = await generateBrollClip({ prompt, outPath, aspectRatio: "9:16", durationSeconds: 6 });
  const size = statSync(clip.outPath).size;

  console.log(`\n✅ Veo clip generated in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`   file     : ${clip.outPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`   duration : ${clip.durationSeconds}s`);
  console.log(`   est. cost: ~$${clip.estCostUsd.toFixed(2)}`);
  console.log(`\n▶︎  Open the file above to check the look. If good, the live pipeline will use Veo automatically.`);
}

main().catch((err) => {
  console.error("❌ Veo test failed:", err instanceof Error ? err.message : err);
  console.error("   (The live pipeline degrades gracefully — shorts still render on the free background.)");
  process.exit(1);
});
