/**
 * Generate a batch of CANDIDATE Veo b-roll clips for the curated library
 * (run ON the Mac runner — needs ffmpeg-free, just GEMINI_API_KEY + Blob).
 *
 *   cd ~/Locksafe\ Project/locksafe-webapp
 *   npx tsx scripts/veo-broll-library.ts            # all prompts
 *   npx tsx scripts/veo-broll-library.ts 3          # just the first 3 (cheaper)
 *
 * Each clip uses an ABSTRACT, atmospheric prompt (no specific human actions —
 * that's what Veo Lite fumbles) so the footage is coherent. Clips are saved
 * locally to ./broll-candidates/ for review AND uploaded to Vercel Blob. Review
 * the local files, then tell Claude which numbers to keep — the keeper URLs go
 * into assets/video/broll-library.json and the engine rotates through them.
 *
 * Cost: ~$0.40 per 8s clip on Veo Lite. Spend is recorded in the monthly ledger.
 */

import "dotenv/config";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { isVeoConfigured, generateBrollClip, veoModel } from "@/lib/veo";
import { canSpend, recordSpend, veoSpendStatus } from "@/lib/veo-budget";

const STYLE =
  "Cinematic UK locksmith brand video. Colour grade: deep navy and warm gold accent lighting. " +
  "Real British setting. Professional, calm, trustworthy mood. Anamorphic look, shallow depth of field. " +
  "Slow, smooth camera motion. No on-screen text, no logos, no readable signage. No identifiable faces.";

// Abstract / atmospheric scenes Veo Lite renders coherently (no fiddly actions).
const SCENES: { label: string; scene: string }[] = [
  { label: "lock-cylinder-macro", scene: "Extreme close-up of a polished brass door-lock cylinder catching warm golden light, slow rack focus, deep navy background." },
  { label: "terrace-doors-dolly", scene: "Slow cinematic dolly past a row of UK Victorian terraced front doors at dusk, warm porch lights glowing, deep navy sky." },
  { label: "keys-on-wood-macro", scene: "Macro shot of a set of metal house keys resting on dark wood under a warm pool of light, slow gentle camera drift." },
  { label: "front-door-letterplate", scene: "Atmospheric close-up of a black-painted British front door with a brass letterplate and knocker, soft rain on the surface, slow push in." },
  { label: "blue-hour-street", scene: "Cinematic wide of a quiet British terraced street at blue hour, warm window lights, wet cobbles reflecting gold, slow aerial drift." },
  { label: "yale-lock-rotation", scene: "Close-up of a brass Yale lock on a wooden door, key slot in focus, warm rim light, slow rotation, deep navy tones." },
  { label: "deadbolt-mechanism", scene: "Macro of a deadbolt sliding mechanism in moody warm light, brushed metal textures, shallow focus, slow motion." },
  { label: "brick-wall-track", scene: "Slow tracking shot along a brick terraced wall toward a softly lit front door at dusk, warm and calm." },
  { label: "streetlight-bokeh", scene: "Abstract bokeh of warm golden streetlights against a deep navy night, soft focus, gentle drift, premium mood." },
  { label: "padlock-chain-macro", scene: "Macro of a heavy brass padlock and chain catching warm directional light against a dark navy background, slow reveal." },
];

async function main() {
  if (!isVeoConfigured()) {
    console.error("❌ GEMINI_API_KEY not set.");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("❌ BLOB_READ_WRITE_TOKEN not set — needed to host the clips.");
    process.exit(1);
  }

  const limit = Number(process.argv[2] || SCENES.length);
  const scenes = SCENES.slice(0, limit);
  const { model, costPerSecondUsd } = veoModel();
  const seconds = Number(process.env.LOCKSAFE_VEO_CLIP_SECONDS || "8");
  const estEach = seconds * costPerSecondUsd;

  const outDir = path.join(process.cwd(), "broll-candidates");
  await mkdir(outDir, { recursive: true });
  // Also drop copies in the workspace root so they're easy to open + review.
  const reviewDir = path.join(process.cwd(), "..", "broll-candidates");
  await mkdir(reviewDir, { recursive: true }).catch(() => {});

  const status = await veoSpendStatus();
  console.log(`🎥 ${model} · ${seconds}s · ~$${estEach.toFixed(2)}/clip`);
  console.log(`💷 Month so far: $${status.spentUsd.toFixed(2)}/$${status.capUsd.toFixed(0)} · generating up to ${scenes.length} clip(s)\n`);

  const manifest: Array<{ n: number; label: string; url: string; file: string; prompt: string }> = [];

  for (let i = 0; i < scenes.length; i++) {
    const { label, scene } = scenes[i];
    const n = i + 1;
    if (!(await canSpend(estEach))) {
      console.log(`⛔ Monthly cap reached — stopping at ${i} clip(s).`);
      break;
    }
    const prompt = `${STYLE} Scene: ${scene}`;
    const localFile = path.join(outDir, `clip-${String(n).padStart(2, "0")}-${label}.mp4`);
    process.stdout.write(`  [${n}/${scenes.length}] ${label} … `);
    try {
      const clip = await generateBrollClip({ prompt, outPath: localFile, aspectRatio: "9:16", durationSeconds: seconds });
      await recordSpend(clip.estCostUsd);
      const blob = await put(`social/video/broll-library/${Date.now()}-${label}.mp4`, await readFile(localFile), {
        access: "public",
        contentType: "video/mp4",
      });
      await copyFile(localFile, path.join(reviewDir, path.basename(localFile))).catch(() => {});
      manifest.push({ n, label, url: blob.url, file: localFile, prompt });
      console.log(`ok ($${clip.estCostUsd.toFixed(2)})`);
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const manifestPath = path.join(outDir, "candidates.json");
  await writeFile(manifestPath, JSON.stringify({ clips: manifest }, null, 2), "utf8");
  await copyFile(manifestPath, path.join(reviewDir, "candidates.json")).catch(() => {});

  const final = await veoSpendStatus();
  console.log(`\n✅ ${manifest.length} candidate(s) generated. Month spend now $${final.spentUsd.toFixed(2)}/$${final.capUsd.toFixed(0)}.`);
  console.log(`📂 Review the clips in:  ${reviewDir}`);
  console.log(`📝 Manifest:             ${manifestPath}`);
  console.log(`\nWatch them, then tell Claude which numbers to keep — the keeper URLs go into assets/video/broll-library.json.`);
}

main().catch((err) => {
  console.error("❌ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
