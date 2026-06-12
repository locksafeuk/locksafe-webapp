/**
 * GET /api/social/poster/[id]
 *
 * Serves a SocialPost's poster image as **JPEG** from the verified locksafe.uk
 * domain. TikTok's Content Posting API (PULL_FROM_URL) only accepts images from
 * a URL-verified domain and requires JPEG — but our posters live on Vercel Blob
 * (an unverified domain, stored as PNG). This route proxies + converts so TikTok
 * can pull the image.
 *
 * Public (no auth): the underlying poster is already public on Blob; this just
 * re-serves it on the right domain in the right format.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import sharp from "sharp";

export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.socialPost.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  if (!post?.imageUrl) {
    return NextResponse.json({ error: "No poster for this post" }, { status: 404 });
  }

  try {
    const upstream = await fetch(post.imageUrl, { signal: AbortSignal.timeout(20_000) });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const src = Buffer.from(await upstream.arrayBuffer());
    const jpeg = await sharp(src).jpeg({ quality: 90 }).toBuffer();

    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch poster" },
      { status: 502 }
    );
  }
}
