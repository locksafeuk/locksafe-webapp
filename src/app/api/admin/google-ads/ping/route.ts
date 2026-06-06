/**
 * Diagnostic: minimal route to test if Vercel deploys NEW route files at all.
 * If GET /api/admin/google-ads/ping returns 404 despite a green deploy, the
 * problem is in deployment pipeline (Vercel build cache, function manifest)
 * rather than in my route code.
 *
 * Delete this file once the coverage route is confirmed working.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      msg: "ping route serves — Vercel deploys NEW route files correctly",
      ts: new Date().toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
