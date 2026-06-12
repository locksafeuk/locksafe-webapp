/**
 * GET /api/social/video/[id]
 *
 * Serves a SocialPost's short video (MP4) from the verified locksafe.uk domain.
 * TikTok's Content Posting API (PULL_FROM_URL) only accepts media from a
 * URL-verified domain — but our videos live on Vercel Blob (an unverified
 * domain). This route streams the Blob MP4 through locksafe.uk so TikTok can
 * pull it. Range requests are supported (TikTok probes with them).
 *
 * Public (no auth): the underlying video is already public on Blob; this just
 * re-serves it on the right domain.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: { videoUrl: true },
  });
  if (!post?.videoUrl) {
    return NextResponse.json({ error: "No video for this post" }, { status: 404 });
  }

  try {
    // Forward any Range header so byte-range probes work.
    const range = req.headers.get("range") ?? undefined;
    const upstream = await fetch(post.videoUrl, {
      headers: range ? { Range: range } : {},
      signal: AbortSignal.timeout(50_000),
    });
    if (!upstream.ok && upstream.status !== 206) {
      throw new Error(`upstream ${upstream.status}`);
    }

    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set("Cache-Control", "public, max-age=86400, immutable");
    headers.set("Accept-Ranges", "bytes");
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    const cr = upstream.headers.get("content-range");
    if (cr) headers.set("Content-Range", cr);

    return new NextResponse(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch video" },
      { status: 502 }
    );
  }
}
