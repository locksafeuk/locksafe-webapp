import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const locksmiths = await prisma.locksmith.findMany({
    where: { isActive: true, onboardingCompleted: true },
    select: {
      id: true,
      name: true,
      email: true,
      companyName: true,
      commissionTier: true,
      commissionRate: true,
      commissionAssessmentRate: true,
      commissionTierReasons: true,
      commissionTierUpdatedAt: true,
      commissionOverride: true,
    },
    orderBy: [{ commissionTier: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ locksmiths });
}
