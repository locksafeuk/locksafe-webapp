/**
 * Shared image-generation pass for organic social posts.
 *
 * Finds SCHEDULED / PENDING_APPROVAL posts that have an `imagePrompt` but no
 * `imageUrl`, generates a poster via ComfyUI (Flux Schnell), uploads to Vercel
 * Blob, and writes back `imageUrl`.
 *
 * Called from two places:
 *  - /api/cron/generate-images (Vercel/manual) — only works if ComfyUI is
 *    reachable from that environment.
 *  - The Mac Studio agent-runner tick — where ComfyUI is local (the reliable
 *    path; this is what keeps posters flowing).
 *
 * Always degrades gracefully: if Blob isn't configured or ComfyUI is
 * unreachable, it returns `{ skipped: true }` instead of throwing.
 */

import { prisma } from "@/lib/db";
import { generateImage, enhanceImagePrompt } from "@/lib/image-gen";
import { sendAdminAlert } from "@/lib/telegram";

export interface ImageGenSummary {
  skipped?: boolean;
  reason?: string;
  processed: number;
  generated: number;
  failed: number;
  /** How many of the generated images used the OpenAI cloud fallback (ComfyUI was down). */
  usedFallback: number;
  results: Array<{ postId: string; success: boolean; url?: string; backend?: string; error?: string }>;
}

export async function generatePendingPostImages(
  opts?: { limit?: number; alert?: boolean }
): Promise<ImageGenSummary> {
  const limit = opts?.limit ?? 10;
  const alert = opts?.alert ?? true;
  const empty: ImageGenSummary = { processed: 0, generated: 0, failed: 0, usedFallback: 0, results: [] };

  // Blob storage is required to persist the generated image.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ...empty, skipped: true, reason: "BLOB_READ_WRITE_TOKEN not configured" };
  }

  // No hard ComfyUI gate any more: generateImage() tries local ComfyUI first and
  // automatically falls back to the OpenAI cloud API, so this works even when the
  // Mac/ComfyUI is off. (If neither backend is available, each post just fails
  // gracefully in the loop below.)

  // Prioritise posts due within 24h that still lack a poster.
  // NB: MongoDB treats `imageUrl: null` as literal-null, so brand-new rows whose
  // imageUrl was never set need `{ isSet: false }` to be caught.
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const posts = await prisma.socialPost.findMany({
    where: {
      status: { in: ["SCHEDULED", "PENDING_APPROVAL"] },
      imagePrompt: { not: null },
      imageUrl: { isSet: false },
      scheduledFor: { lte: in24h },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  if (posts.length === 0) return empty;

  const results: ImageGenSummary["results"] = [];
  let generated = 0;
  let usedFallback = 0;

  for (const post of posts) {
    if (!post.imagePrompt) continue;
    try {
      const enhancedPrompt = await enhanceImagePrompt(post.imagePrompt);
      // Force a TEXT-FREE background — the headline is overlaid as real font
      // text afterwards (AI-rendered text is always misspelled).
      const cleanPrompt =
        `${enhancedPrompt}\n\nIMPORTANT: Do NOT render any text, letters, words, ` +
        `numbers, captions, logos, signs, or watermarks anywhere in the image. ` +
        `Produce only photographic/illustrative imagery with clean, uncluttered ` +
        `space in the lower third where a headline will be placed separately.`;
      const result = await generateImage({
        prompt: cleanPrompt,
        format: "poster",
        blobPrefix: `social/${post.contentPillar ?? "general"}`,
        // Exact, proofread headline → rendered as real text (zero typos).
        overlayHeadline: post.headline ?? undefined,
      });
      await prisma.socialPost.update({ where: { id: post.id }, data: { imageUrl: result.url } });
      generated++;
      if (result.backend === "openai") usedFallback++;
      results.push({ postId: post.id, success: true, url: result.url, backend: result.backend });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ postId: post.id, success: false, error: msg });
    }
  }

  if (alert && generated > 0) {
    const via = usedFallback > 0
      ? `${generated - usedFallback} via ComfyUI, ${usedFallback} via OpenAI fallback`
      : `Flux Schnell via ComfyUI`;
    await sendAdminAlert({
      title: "🎨 Images Generated",
      message: `Generated ${generated}/${posts.length} poster image(s) for scheduled social posts.\n${via}`,
      severity: "info",
    }).catch(() => {});
  }

  const failed = results.filter((r) => !r.success).length;
  if (alert && failed > 0 && generated === 0) {
    await sendAdminAlert({
      title: "⚠️ Image Generation Failed",
      message: `All ${failed} image generations failed (ComfyUI + OpenAI fallback both unavailable?).\nFirst error: ${results.find((r) => !r.success)?.error}`,
      severity: "warning",
    }).catch(() => {});
  }

  return { processed: posts.length, generated, failed, usedFallback, results };
}
