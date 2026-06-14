import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import {
  COMPLETENESS_SELECT,
  computeCompleteness,
  getAvailabilityBlock,
} from "@/lib/locksmith-completeness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin diagnostic: why can (or can't) a given locksmith go "Available"?
// Returns each completeness item's done/blocking state + the raw underlying
// field values + the exact availability-block result. Query by ?id= or ?email=.
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const email = searchParams.get("email");
  if (!id && !email) {
    return NextResponse.json({ error: "id or email required" }, { status: 400 });
  }

  const locksmith = await prisma.locksmith.findFirst({
    where: id ? { id } : { email: email!.toLowerCase().trim() },
    select: { id: true, name: true, email: true, isAvailable: true, ...COMPLETENESS_SELECT },
  });
  if (!locksmith) {
    return NextResponse.json({ error: "locksmith not found" }, { status: 404 });
  }

  const completeness = computeCompleteness(locksmith);
  const block = await getAvailabilityBlock(locksmith.id);

  return NextResponse.json({
    locksmith: { id: locksmith.id, name: locksmith.name, email: locksmith.email, isAvailable: locksmith.isAvailable },
    canGoAvailable: block === null,
    block, // null = no block; otherwise { message, deepLink, alsoMissing }
    blockingMissing: completeness.missing.filter((m) => m.blocking).map((m) => m.key),
    items: completeness.items,
    rawFields: {
      termsAcceptedAt: locksmith.termsAcceptedAt,
      baseAddress: locksmith.baseAddress,
      baseLat: locksmith.baseLat,
      baseLng: locksmith.baseLng,
      defaultAssessmentFee: locksmith.defaultAssessmentFee,
      stripeConnectOnboarded: locksmith.stripeConnectOnboarded,
      stripeConnectVerified: locksmith.stripeConnectVerified,
      profileImage: locksmith.profileImage ? "set" : null,
      profilePhotoVerified: locksmith.profilePhotoVerified,
      insuranceDocumentUrl: locksmith.insuranceDocumentUrl ? "set" : null,
      insuranceStatus: locksmith.insuranceStatus,
    },
  });
}
