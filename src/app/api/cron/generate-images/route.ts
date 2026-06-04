/**
 * Cron Job: /api/cron/generate-images
 *
 * Generates AI images for scheduled social posts that have an imagePrompt
 * but no imageUrl yet. Uses Flux Schnell via local ComfyUI.
 *
 * Pipeline:
 *   1. generate-organic (5am)  → creates SocialPost with imagePrompt
 *   2. generate-images  (7am)  → this route: generates + uploads image → sets imageUrl
 *   3. publish-organic  (9am)  → publishes post WITH image to Facebook/Instagram
 *
 * Requirements:
 *   COMFYUI_BASE_URL  — ComfyUI server (default: http://localhost:8188)
 *   BLOB_READ_WRITE_TOKEN — Vercel Blob token for image storage
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { generateImage, enhanceImagePrompt } from "@/lib/image-gen";
import { sendAdminAlert } from "@/lib/telegram";

async function verifyAccess(request: NextRequest): Promise<boolean> {
  if (verifyCronAuth(request)) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === "admin") return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const hasAccess = await verifyAccess(request);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Guard: Vercel Blob must be configured for image storage
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn("[generate-images] BLOB_READ_WRITE_TOKEN not set — skipping image generation");
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "BLOB_READ_WRITE_TOKEN not configured",
    });
  }

  // Check ComfyUI is reachable before processing posts
  const comfyUrl = process.env.COMFYUI_BASE_URL ?? "http://localhost:8188";
  try {
    const health = await fetch(`${comfyUrl}/system_stats`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!health.ok) throw new Error(`Status ${health.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[generate-images] ComfyUI unreachable at ${comfyUrl}: ${msg}`);
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: `ComfyUI unreachable: ${msg}`,
    });
  }

  // Find posts that need images: SCHEDULED, have imagePrompt, but no imageUrl yet
  // Limit to posts scheduled within the next 24 hours (prioritise immediate pipeline)
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const posts = await prisma.socialPost.findMany({
    where: {
      status: { in: ["SCHEDULED", "PENDING_APPROVAL"] },
      imagePrompt: { not: null },
      imageUrl: null,
      scheduledFor: { lte: in24h },
    },
    orderBy: { scheduledFor: "asc" },
    take: 10, // Process max 10 per run (each takes ~30s)
  });

  if (posts.length === 0) {
    console.log("[generate-images] No posts awaiting image generation");
    return NextResponse.json({ success: true, processed: 0, generated: 0 });
  }

  console.log(`[generate-images] Found ${posts.length} posts needing images`);

  const results: Array<{ postId: string; success: boolean; url?: string; error?: string }> = [];
  let generated = 0;

  for (const post of posts) {
    if (!post.imagePrompt) continue;

    try {
      // Enhance prompt with Ollama for better Flux results
      console.log(`[generate-images] Enhancing prompt for post ${post.id}...`);
      const enhancedPrompt = await enhanceImagePrompt(post.imagePrompt);

      // Generate a poster-style image for every organic post.
      const format = "poster";

      // Generate image via ComfyUI Flux Schnell
      console.log(`[generate-images] Generating ${format} image for post ${post.id}...`);
      const result = await generateImage({
        prompt: enhancedPrompt,
        format,
        blobPrefix: `social/${post.contentPillar ?? "general"}`,
      });

      // Update post with image URL
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { imageUrl: result.url },
      });

      generated++;
      results.push({ postId: post.id, success: true, url: result.url });
      console.log(`[generate-images] ✓ Post ${post.id}: ${result.url}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[generate-images] ✗ Post ${post.id}:`, msg);
      results.push({ postId: post.id, success: false, error: msg });
    }
  }

  // Telegram summary if any were generated
  if (generated > 0) {
    await sendAdminAlert({
      title: "🎨 Images Generated",
      message: `Generated ${generated}/${posts.length} images for scheduled social posts.\nModel: Flux Schnell via ComfyUI`,
      severity: "info",
    }).catch(() => {}); // Non-critical
  }

  const failures = results.filter((r) => !r.success);
  if (failures.length > 0 && generated === 0) {
    await sendAdminAlert({
      title: "⚠️ Image Generation Failed",
      message: `All ${failures.length} image generations failed.\nFirst error: ${failures[0].error}`,
      severity: "warning",
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    processed: posts.length,
    generated,
    failed: results.filter((r) => !r.success).length,
    results,
  });
}
