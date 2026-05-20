export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DEFAULT_REALISM_PROFILE,
  buildRealismExperimentMatrix,
  normalizeRealismProfile,
} from "@/lib/retell-realism";

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ error: "Active config not found" }, { status: 404 });
    }

    const profile = normalizeRealismProfile(config.realismProfile ?? DEFAULT_REALISM_PROFILE);
    const matrix = buildRealismExperimentMatrix(profile);

    return NextResponse.json({ success: true, profile, matrix });
  } catch (error: any) {
    console.error("[API] Error fetching realism profile:", error);
    return NextResponse.json({ error: "Failed to fetch realism profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });
    if (!config) {
      return NextResponse.json({ error: "Active config not found" }, { status: 404 });
    }

    const body = await request.json();
    const profile = normalizeRealismProfile(body);

    const updated = await prisma.voiceAgentConfig.update({
      where: { id: config.id },
      data: { realismProfile: profile },
    });

    return NextResponse.json({
      success: true,
      realismProfile: updated.realismProfile,
      matrix: buildRealismExperimentMatrix(profile),
    });
  } catch (error: any) {
    console.error("[API] Error updating realism profile:", error);
    return NextResponse.json({ error: "Failed to update realism profile" }, { status: 500 });
  }
}
