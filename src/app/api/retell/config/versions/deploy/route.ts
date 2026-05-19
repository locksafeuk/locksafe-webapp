import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

// POST /api/retell/config/versions/deploy
// Body: { versionId: string }
export async function POST(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const versionId = typeof body?.versionId === "string" ? body.versionId : undefined;
    if (!versionId) {
      return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
    }
    const version = await prisma.voiceAgentConfigVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    await prisma.voiceAgentConfigVersion.updateMany({
      where: { configId: version.configId, isDeployed: true },
      data: { isDeployed: false, deployedAt: null, deployedBy: null },
    });
    const deployed = await prisma.voiceAgentConfigVersion.update({
      where: { id: versionId },
      data: {
        isDeployed: true,
        deployedAt: new Date(),
        deployedBy: admin.email || "admin",
      },
    });
    return NextResponse.json({ success: true, deployed });
  } catch (error: any) {
    console.error("[API] Error deploying config version:", error);
    return NextResponse.json({ error: "Failed to deploy version" }, { status: 500 });
  }
}

// PATCH /api/retell/config/versions/deploy
// Body: { versionId: string }
export async function PATCH(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const versionId = typeof body?.versionId === "string" ? body.versionId : undefined;
    if (!versionId) {
      return NextResponse.json({ error: "Missing versionId" }, { status: 400 });
    }
    const version = await prisma.voiceAgentConfigVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const rolledBack = await prisma.voiceAgentConfigVersion.update({
      where: { id: versionId },
      data: {
        isDeployed: false,
        deployedAt: null,
        deployedBy: null,
      },
    });
    return NextResponse.json({ success: true, rolledBack });
  } catch (error: any) {
    console.error("[API] Error rolling back config version:", error);
    return NextResponse.json({ error: "Failed to rollback version" }, { status: 500 });
  }
}