import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

/**
 * GET /api/admin/locksmiths — admin locksmith list for dashboard pickers/overlays.
 *
 * The admin commission-tiers assign dropdown and the coverage map both call this
 * with `?verified=true&active=true&limit=50` / `?status=active&limit=200`. The
 * bare route never existed, so both fetches 404'd silently (empty dropdown / no
 * coverage overlay). Returns `{ locksmiths }` honouring those query params.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const verified = sp.get("verified");
  const active = sp.get("active");
  const status = sp.get("status");
  const limit = Math.min(Number(sp.get("limit")) || 200, 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (verified === "true") where.isVerified = true;
  if (active === "true" || status === "active") where.isActive = true;

  const locksmiths = await prisma.locksmith.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      isActive: true,
      isVerified: true,
      commissionTier: true,
      commissionOverride: true,
      baseLat: true,
      baseLng: true,
      coverageRadius: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return NextResponse.json({ success: true, locksmiths });
}
