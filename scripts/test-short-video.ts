/**
 * One-shot smoke test for the short-video engine (run ON the Mac runner).
 *
 *   cd ~/Locksafe\ Project/locksafe-webapp
 *   npx tsx scripts/test-short-video.ts
 *
 * Renders a sample 9:16 captioned short with an OpenAI TTS voiceover, uploads it
 * to Vercel Blob, and prints the URL. Validates the full chain on the real host:
 * ffmpeg + sharp/SVG caption fonts + TTS + Blob. Uses a few pennies of TTS.
 *
 * Requires: ffmpeg on PATH, BLOB_READ_WRITE_TOKEN, and (for voiceover) OPENAI_API_KEY.
 */

import "dotenv/config";
import {
  generateShortVideo,
  scriptToCards,
  isShortVideoSupported,
} from "@/lib/short-video";

async function main() {
  if (!(await isShortVideoSupported())) {
    console.error("❌ ffmpeg not available on PATH (set FFMPEG_PATH or install ffmpeg).");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("❌ BLOB_READ_WRITE_TOKEN not set — cannot upload the test MP4.");
    process.exit(1);
  }
  console.log(`🎬 TTS: ${process.env.OPENAI_API_KEY ? "on (OpenAI)" : "OFF (no OPENAI_API_KEY → silent video)"}`);

  // A proofread sample script (the same anti-rip-off angle as the demo).
  const script = {
    hook: "That £50 quote just became £380.",
    body:
      "1. Get the full price in writing before any work begins. " +
      "2. Check ID, insurance and real reviews — walk away from 'cash only'. " +
      "3. No paperwork means no proof, so always get a written report.",
    cta: "LockSafe shows the price before the door opens. Search LockSafe.",
  };

  const cards = scriptToCards(script);
  console.log(`📝 ${cards.length} caption cards:`, cards.map((c) => (c.badge ? `[${c.badge}] ` : "") + c.text.replace(/\n/g, " ")).join("  |  "));

  const t0 = Date.now();
  const result = await generateShortVideo({
    cards,
    voiceover: [script.hook, script.body, script.cta].join(" "),
    blobPrefix: "social/video/_smoketest",
  });

  console.log(`\n✅ Rendered in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`   duration : ${result.durationSeconds.toFixed(1)}s`);
  console.log(`   voiceover: ${result.hasVoiceover ? "yes" : "no (silent)"}`);
  console.log(`   background: ${result.background}`);
  console.log(`\n🔗 ${result.url}\n`);
}

main().catch((err) => {
  console.error("❌ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
