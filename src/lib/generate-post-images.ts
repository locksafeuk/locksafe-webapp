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
  results: Array<{ postId: string; success: boolean; url?: string; error?: string }>;
}

export async function generatePendingPostImages(
  opts?: { limit?: number; alert?: boolean }
): Promise<ImageGenSummary> {
  const limit = opts?.limit ?? 10;
  const alert = opts?.alert ?? true;
  const empty: ImageGenSummary = { processed: 0, generated: 0, failed: 0, results: [] };

  // Blob storage is required to persist the generated image.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { ...empty, skipped: true, reason: "BLOB_READ_WRITE_TOKEN not configured" };
  }

  // ComfyUI must be reachable (localhost on the Mac runner; elsewhere it won't be).
  const comfyUrl = process.env.COMFYUI_BASE_URL ?? "http://localhost:8188";
  try {
    const health = await fetch(`${comfyUrl}/system_stats`, { signal: AbortSignal.timeout(5_000) });
    if (!health.ok) throw new Error(`Status ${health.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...empty, skipped: true, reason: `ComfyUI unreachable at ${comfyUrl}: ${msg}` };
  }

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

  for (const post of posts) {
    if (!post.imagePrompt) continue;
    try {
      const enhancedPrompt = await enhanceImagePrompt(post.imagePrompt);
      const result = await generateImage({
        prompt: enhancedPrompt,
        format: "poster",
        blobPrefix: `social/${post.contentPillar ?? "general"}`,
      });
      await prisma.socialPost.update({ where: { id: post.id }, data: { imageUrl: result.url } });
      generated++;
      results.push({ postId: post.id, success: true, url: result.url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ postId: post.id, success: false, error: msg });
    }
  }

  if (alert && generated > 0) {
    await sendAdminAlert({
      title: "🎨 Images Generated",
      message: `Generated ${generated}/${posts.length} poster image(s) for scheduled social posts.\nModel: Flux Schnell via ComfyUI`,
      severity: "info",
    }).catch(() => {});
  }

  const failed = results.filter((r) => !r.success).length;
  if (alert && failed > 0 && generated === 0) {
    await sendAdminAlert({
      title: "⚠️ Image Generation Failed",
      message: `All ${failed} image generations failed.\nFirst error: ${results.find((r) => !r.success)?.error}`,
      severity: "warning",
    }).catch(() => {});
  }

  return { processed: posts.length, generated, failed, results };
}
