export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const call = await prisma.voiceCall.findUnique({ where: { id } });
    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, call });
  } catch (error: any) {
    console.error("[API] Error fetching call:", error);
    return NextResponse.json({ error: "Failed to fetch call" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { flaggedForReview, reviewNotes } = body ?? {};

    const updateData: any = {};
    if (typeof flaggedForReview === "boolean") updateData.flaggedForReview = flaggedForReview;
    if (typeof reviewNotes === "string") updateData.reviewNotes = reviewNotes;

    const call = await prisma.voiceCall.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, call });
  } catch (error: any) {
    console.error("[API] Error updating call:", error);
    return NextResponse.json({ error: "Failed to update call" }, { status: 500 });
  }
}
