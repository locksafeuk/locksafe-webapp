export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_PROFILE = {
  interruptionSensitivity: "medium",
  backchannelFrequency: "medium",
  pauseStyle: "natural",
  noiseHandling: "adaptive",
  pronunciationHints: [] as string[],
};

function buildExperimentMatrix(profile: any) {
  const interruptionLevels = ["low", "medium", "high"];
  const backchannelLevels = ["low", "medium", "high"];
  const pauseStyles = ["concise", "natural", "empathetic"];

  const matrix = [];
  for (const i of interruptionLevels) {
    for (const b of backchannelLevels) {
      for (const p of pauseStyles) {
        matrix.push({
          interruptionSensitivity: i,
          backchannelFrequency: b,
          pauseStyle: p,
          noiseHandling: profile?.noiseHandling ?? "adaptive",
        });
      }
    }
  }

  return matrix;
}

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

    const profile = (config.realismProfile as any) ?? DEFAULT_PROFILE;
    const matrix = buildExperimentMatrix(profile);

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
    const profile = {
      interruptionSensitivity:
        typeof body?.interruptionSensitivity === "string" ? body.interruptionSensitivity : "medium",
      backchannelFrequency:
        typeof body?.backchannelFrequency === "string" ? body.backchannelFrequency : "medium",
      pauseStyle: typeof body?.pauseStyle === "string" ? body.pauseStyle : "natural",
      noiseHandling: typeof body?.noiseHandling === "string" ? body.noiseHandling : "adaptive",
      pronunciationHints: Array.isArray(body?.pronunciationHints)
        ? body.pronunciationHints.filter((x: any) => typeof x === "string")
        : [],
    };

    const updated = await prisma.voiceAgentConfig.update({
      where: { id: config.id },
      data: { realismProfile: profile },
    });

    return NextResponse.json({ success: true, realismProfile: updated.realismProfile, matrix: buildExperimentMatrix(profile) });
  } catch (error: any) {
    console.error("[API] Error updating realism profile:", error);
    return NextResponse.json({ error: "Failed to update realism profile" }, { status: 500 });
  }
}
