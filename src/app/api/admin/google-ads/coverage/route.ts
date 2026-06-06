/**
 * GET /api/admin/google-ads/coverage — minimal bisect version.
 * Tests if importing campaign-coverage-builder is what breaks the route.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mod = await import("@/lib/campaign-coverage-builder");
    const map = await mod.computeCoverageMap();
    return Response.json({
      ok: true,
      eligibleCount: map.eligibleGeoIds.length,
      activeLocksmiths: map.activeLocksmithCount,
      eligibleGeoIds: map.eligibleGeoIds,
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
    }, { status: 500 });
  }
}
