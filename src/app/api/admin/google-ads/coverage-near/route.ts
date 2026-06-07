/**
 * GET /api/admin/google-ads/coverage-near?lat=51.5&lng=-0.1&radius=15
 *
 * Strategic planning endpoint: returns every active locksmith within
 * `radius` miles of the (lat, lng) point. Used to evaluate "if we
 * targeted [outer London / North London / Croydon / Romford] specifically,
 * how many locksmiths would we have to fulfil jobs in that exact zone?"
 *
 * Auth: admin JWT cookie.
 *
 * Query params:
 *   lat       (required, number) — centre latitude
 *   lng       (required, number) — centre longitude
 *   radius    (optional, miles, default 10)
 *
 * Returns: list of locksmiths with name + base postcode + distance, sorted
 * by distance ascending.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { haversineMiles } from "@/lib/google-ads-locations";
import { prisma as _prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

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

export async function GET(request: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radius = Number(url.searchParams.get("radius") ?? "10");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params are required (numbers)" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    return NextResponse.json(
      { error: "radius must be a positive number (miles)" },
      { status: 400 },
    );
  }

  const all = await prisma.locksmith.findMany({
    where: {
      isActive: true,
      onboardingCompleted: true,
      baseLat: { not: null },
      baseLng: { not: null },
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      baseAddress: true,
      baseLat: true,
      baseLng: true,
    },
  });

  const within = all
    .map((l: { id: string; name: string; companyName: string | null; baseAddress: string | null; baseLat: number; baseLng: number }) => ({
      id: l.id,
      name: l.name,
      companyName: l.companyName,
      baseAddress: l.baseAddress,
      baseLat: l.baseLat,
      baseLng: l.baseLng,
      distance_mi: haversineMiles(
        { lat, lng },
        { lat: l.baseLat, lng: l.baseLng },
      ),
    }))
    .filter((l: { distance_mi: number }) => l.distance_mi <= radius)
    .sort((a: { distance_mi: number }, b: { distance_mi: number }) => a.distance_mi - b.distance_mi);

  return NextResponse.json({
    centre: { lat, lng },
    radius_miles: radius,
    count: within.length,
    locksmiths: within.map((l: {
      name: string; companyName: string | null; baseAddress: string | null;
      baseLat: number; baseLng: number; distance_mi: number;
    }) => ({
      name: l.name,
      companyName: l.companyName,
      baseAddress: l.baseAddress,
      distance_mi: Number(l.distance_mi.toFixed(1)),
      // Rounded coords so we can see approximate clustering without
      // exposing exact home addresses in admin output.
      approxLat: Number(l.baseLat.toFixed(2)),
      approxLng: Number(l.baseLng.toFixed(2)),
    })),
  });
}
