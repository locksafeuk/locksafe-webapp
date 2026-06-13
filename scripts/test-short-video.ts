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

  // A proofread, high-impact ANTI-SCAM sample (the new direction).
  const script = {
    hook: "They drilled your lock in 5 minutes and charged £350.",
    body:
      "1. A real locksmith PICKS the lock — drilling is a red flag. " +
      "2. Get the full price IN WRITING before any work starts. " +
      "3. No ID and no invoice? That's your cue to walk away.",
    cta: "LockSafe vets every locksmith and shows the price upfront.",
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
  console.log(`\n🔗 ${result.url}`);

  // Also save a local copy in the workspace folder so it can be reviewed/inspected.
  try {
    const { writeFile } = await import("node:fs/promises");
    const localPath = `${process.cwd()}/../short-sample.mp4`;
    const buf = Buffer.from(await (await fetch(result.url)).arrayBuffer());
    await writeFile(localPath, buf);
    console.log(`💾 Saved a copy to: ~/Locksafe Project/short-sample.mp4\n`);
  } catch {
    console.log("");
  }
}

main().catch((err) => {
  console.error("❌ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
