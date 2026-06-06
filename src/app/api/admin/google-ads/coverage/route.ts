/**
 * GET /api/admin/google-ads/coverage
 *
 * Returns the current coverage map computed from active locksmiths
 * with the user-locked rules (10mi hard / ≥2 floor). Use this from
 * the admin UI to see which UK cities currently qualify as campaign
 * geo targets, and which are excluded and why.
 *
 * Query params:
 *   ?radius=15&floor=1   — what-if overrides (does NOT mutate config)
 *
 * Auth: admin JWT cookie.
 *
 * NOTE: This file deliberately avoids `Parameters<typeof ...>` generics
 * and other constructs that confused the Vercel Next.js bundler — an
 * earlier version of this file deployed with OPTIONS:204 but GET:404
 * because the GET handler got tree-shaken out of the function bundle.
 * Plain inline type for opts is the workaround.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { computeCoverageMap } from "@/lib/campaign-coverage-builder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface CoverageOpts {
  radiusMiles?: number;
  minLocksmithsPerGeo?: number;
}

export async function GET(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const radiusOverride = url.searchParams.get("radius");
  const floorOverride = url.searchParams.get("floor");

  const opts: CoverageOpts = {};
  if (radiusOverride) {
    const r = Number(radiusOverride);
    if (Number.isFinite(r) && r > 0) opts.radiusMiles = r;
  }
  if (floorOverride) {
    const f = Number(floorOverride);
    if (Number.isFinite(f) && f >= 0 && Number.isInteger(f)) {
      opts.minLocksmithsPerGeo = f;
    }
  }

  const map = await computeCoverageMap(opts);

  // Sort: eligible first (by locksmith count desc), then excluded.
  const sorted = [...map.entries].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.locksmithCount - a.locksmithCount;
  });

  return NextResponse.json({
    summary: {
      eligibleGeoCount: map.eligibleGeoIds.length,
      excludedGeoCount: map.entries.length - map.eligibleGeoIds.length,
      activeLocksmithCount: map.activeLocksmithCount,
      skippedLocksmithCount: map.skippedLocksmithCount,
      computedAt: map.computedAt.toISOString(),
      effectiveRadiusMiles: opts.radiusMiles ?? 10,
      effectiveMinLocksmithsPerGeo: opts.minLocksmithsPerGeo ?? 2,
    },
    eligibleGeoIds: map.eligibleGeoIds,
    cities: sorted.map((e) => ({
      cityName: e.cityName,
      geoId: e.geoId,
      eligible: e.eligible,
      excludedReason: e.excludedReason,
      locksmithCount: e.locksmithCount,
      coveringLocksmiths: e.covering.map((l) => ({ id: l.id, name: l.name })),
    })),
  });
}
