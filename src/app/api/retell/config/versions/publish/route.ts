export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishVoiceConfigVersion } from "@/lib/retell-orchestration";

export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const versionId = typeof body?.versionId === "string" ? body.versionId : "";
    const dryRun = Boolean(body?.dryRun);

    if (!versionId) {
      return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
    }

    const result = await publishVoiceConfigVersion({
      versionId,
      dryRun,
      deployedBy: admin.email || "admin",
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      deployment: result.deployment,
      providerVersionId: result.providerVersionId,
    });
  } catch (error: any) {
    console.error("[API] Error publishing voice config version:", error);
    return NextResponse.json({ error: "Failed to publish config version" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deployments = await prisma.voiceConfigDeployment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, deployments });
  } catch (error: any) {
    console.error("[API] Error listing voice deployments:", error);
    return NextResponse.json({ error: "Failed to list deployments" }, { status: 500 });
  }
}
