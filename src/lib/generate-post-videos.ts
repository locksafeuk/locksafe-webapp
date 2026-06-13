/**
 * Shared short-video generation pass for TikTok-targeted organic posts.
 *
 * Finds SCHEDULED / PENDING_APPROVAL posts that target TikTok and lack a
 * `videoUrl`, builds a script (reusing `tiktokScript` if present, else
 * generating one), renders a 9:16 captioned short with an OpenAI TTS voiceover
 * over the post's Flux poster (or a branded gradient), uploads the MP4 to Vercel
 * Blob, and writes back `videoUrl` + `tiktokScript`.
 *
 * Runs on the **Mac Studio agent-runner** (where ffmpeg lives). On Vercel
 * serverless (no ffmpeg) it returns `{ skipped: true }` instead of throwing.
 */

import { prisma } from "@/lib/db";
import {
  generateShortVideo,
  scriptToCards,
  isShortVideoSupported,
} from "@/lib/short-video";
import { generateTikTokScript, type TikTokScript } from "@/lib/tiktok";
import { pickBrollUrl } from "@/lib/broll-library";
import { sendAdminAlert } from "@/lib/telegram";

export interface VideoGenSummary {
  skipped?: boolean;
  reason?: string;
  processed: number;
  generated: number;
  failed: number;
  veoClips: number;
  results: Array<{ postId: string; success: boolean; url?: string; background?: string; error?: string }>;
}

/** Parse a stored tiktokScript JSON string into a TikTokScript, or null. */
function parseScript(raw?: string | null): TikTokScript | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<TikTokScript>;
    if (p.hook && p.body && p.cta) return p as TikTokScript;
  } catch {
    /* not JSON */
  }
  return null;
}

export async function generatePendingPostVideos(
  opts?: { limit?: number; alert?: boolean }
): Promise<VideoGenSummary> {
  const limit = opts?.limit ?? 3;
  const alert = opts?.alert ?? true;
  const empty: VideoGenSummary = { processed: 0, generated: 0, failed: 0, veoClips: 0, results: [] };

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ...empty, skipped: true, reason: "BLOB_READ_WRITE_TOKEN not configured" };
  }
  // ffmpeg only exists on the Mac runner — silently skip elsewhere (Vercel).
  if (!(await isShortVideoSupported())) {
    return { ...empty, skipped: true, reason: "ffmpeg not available (not the Mac runner)" };
  }

  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const posts = await prisma.socialPost.findMany({
    where: {
      status: { in: ["SCHEDULED", "PENDING_APPROVAL"] },
      platforms: { has: "TIKTOK" },
      videoUrl: { isSet: false },
      scheduledFor: { lte: in24h },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  if (posts.length === 0) return empty;

  const results: VideoGenSummary["results"] = [];
  let generated = 0;
  let veoClips = 0;

  for (const post of posts) {
    try {
      // 1. Script: reuse stored, else generate (and persist for reuse).
      let script = parseScript(post.tiktokScript);
      if (!script) {
        const topic = post.headline || post.content.slice(0, 80);
        const pillar =
          (post.contentPillar as
            | "security-tips"
            | "success-stories"
            | "trust-signals"
            | "behind-scenes"
            | "engagement") || "security-tips";
        script = await generateTikTokScript(topic, pillar);
      }

      // 2. Proofread captions (our text → zero typos) + fuller VO script.
      const cards = scriptToCards(script);
      const voiceover = [script.hook, script.body, script.cta]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // 3. Background: rotate through the CURATED b-roll library (pre-approved
      //    Veo clips, ~zero per-post cost). Empty library → free Flux poster /
      //    branded gradient. The clip is looped under the dark scrim + captions.
      const brollUrl = await pickBrollUrl();
      if (brollUrl) veoClips++;

      // 4. Render: library b-roll → Flux poster → branded gradient (in order).
      const result = await generateShortVideo({
        cards,
        voiceover,
        backgroundVideoUrl: brollUrl ?? undefined,
        backgroundImageUrl: brollUrl ? undefined : post.imageUrl ?? undefined,
        blobPrefix: `social/video/${post.contentPillar ?? "general"}`,
      });

      await prisma.socialPost.update({
        where: { id: post.id },
        data: { videoUrl: result.url, tiktokScript: JSON.stringify(script) },
      });
      generated++;
      results.push({ postId: post.id, success: true, url: result.url, background: result.background });
    } catch (err) {
      results.push({
        postId: post.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const failed = results.filter((r) => !r.success).length;

  if (alert && generated > 0) {
    const brollLine = veoClips > 0
      ? `\n🎥 ${veoClips}/${generated} used a curated b-roll background.`
      : "";
    await sendAdminAlert({
      title: "🎬 Shorts Generated",
      message: `Rendered ${generated}/${posts.length} TikTok short(s) with voiceover + captions.${brollLine}`,
      severity: "info",
    }).catch(() => {});
  }
  if (alert && failed > 0 && generated === 0) {
    await sendAdminAlert({
      title: "⚠️ Short-Video Generation Failed",
      message: `All ${failed} short(s) failed.\nFirst error: ${results.find((r) => !r.success)?.error}`,
      severity: "warning",
    }).catch(() => {});
  }

  return { processed: posts.length, generated, failed, veoClips, results };
}
