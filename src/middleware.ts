import { type NextRequest, NextResponse } from "next/server";

/**
 * TikTok site-ownership verification.
 *
 * TikTok verifies domain ownership by requesting
 *   https://<domain>/tiktok<TOKEN>.txt
 * and expecting the body to equal
 *   tiktok-developers-site-verification=<TOKEN>
 *
 * TikTok rotates <TOKEN> frequently, so shipping a single static file in
 * /public goes stale before a deploy finishes (this caused repeated
 * "Invalid Website URL" rejections). Instead, we derive the body from the
 * requested filename, so ANY token TikTok asks for verifies instantly and
 * we never need to redeploy when the token rotates.
 *
 * The pattern is intentionally strict (tiktok + 16-64 alphanumerics + .txt)
 * so this only ever responds to genuine TikTok verification probes.
 */
const TIKTOK_VERIFY = /^\/tiktok([A-Za-z0-9]{16,64})\.txt$/;

export function middleware(req: NextRequest) {
  const match = req.nextUrl.pathname.match(TIKTOK_VERIFY);
  if (match) {
    const token = match[1];
    return new NextResponse(`tiktok-developers-site-verification=${token}`, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  // Only run for top-level paths that start with "tiktok" — keeps middleware
  // off every other request. The handler above further restricts to the exact
  // verification filename and lets anything else (e.g. tiktok-test.jpg) fall
  // through to normal static/route handling.
  matcher: ["/:file(tiktok.*)"],
};
