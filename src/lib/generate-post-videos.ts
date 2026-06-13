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

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/db";
import {
  generateShortVideo,
  scriptToCards,
  isShortVideoSupported,
} from "@/lib/short-video";
import { generateTikTokScript, type TikTokScript } from "@/lib/tiktok";
import { isVeoConfigured, brollPrompt, generateBrollClip, veoModel } from "@/lib/veo";
import { canSpend as canVeoSpend, recordSpend as recordVeoSpend, veoSpendStatus } from "@/lib/veo-budget";
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
    // Each post gets its own temp dir for an optional Veo clip.
    const tmpDir = await mkdtemp(path.join(tmpdir(), "veo-"));
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

      // 3. Optional Veo-Lite b-roll background (budget-gated). Any failure →
      //    fall back to the free Flux poster / branded gradient. Veo is a
      //    best-effort enhancement; it never blocks a short from rendering.
      let backgroundVideoPath: string | undefined;
      if (isVeoConfigured()) {
        const { costPerSecondUsd } = veoModel();
        const clipSeconds = Number(process.env.LOCKSAFE_VEO_CLIP_SECONDS || "6");
        const estCost = clipSeconds * costPerSecondUsd;
        if (await canVeoSpend(estCost)) {
          try {
            const theme = post.headline || post.imagePrompt || post.content.slice(0, 120);
            const clip = await generateBrollClip({
              prompt: brollPrompt(theme),
              outPath: path.join(tmpDir, "broll.mp4"),
              aspectRatio: "9:16",
              durationSeconds: clipSeconds,
            });
            backgroundVideoPath = clip.outPath;
            await recordVeoSpend(clip.estCostUsd);
            veoClips++;
          } catch (veoErr) {
            console.warn(`[generate-post-videos] Veo b-roll failed (${post.id}), using free bg: ${veoErr instanceof Error ? veoErr.message : String(veoErr)}`);
          }
        } else {
          console.log(`[generate-post-videos] Veo monthly cap reached — using free background for ${post.id}`);
        }
      }

      // 4. Render: Veo b-roll → Flux poster → branded gradient (in that order).
      const result = await generateShortVideo({
        cards,
        voiceover,
        backgroundVideoPath,
        backgroundImageUrl: backgroundVideoPath ? undefined : post.imageUrl ?? undefined,
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
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const failed = results.filter((r) => !r.success).length;

  if (alert && generated > 0) {
    let veoLine = "";
    if (veoClips > 0) {
      const s = await veoSpendStatus();
      veoLine = `\n🎥 ${veoClips} Veo b-roll clip(s). Month spend: $${s.spentUsd.toFixed(2)}/$${s.capUsd.toFixed(0)}.`;
    }
    await sendAdminAlert({
      title: "🎬 Shorts Generated",
      message: `Rendered ${generated}/${posts.length} TikTok short(s) with voiceover + captions.${veoLine}`,
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
