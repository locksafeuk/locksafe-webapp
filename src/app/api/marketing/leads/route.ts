import { NextRequest, NextResponse } from "next/server";
import { saveLeadMagnet, updateUserSegment } from "@/lib/marketing/tracker";

// POST - Save lead magnet signup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, phone, source, segment, sessionId } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const lead = await saveLeadMagnet({
      email: email.toLowerCase().trim(),
      name: name?.trim(),
      phone: phone?.trim(),
      source: source || "unknown",
      segment: segment || [],
    });

    // Update session segment to include "lead"
    if (sessionId) {
      await updateUserSegment(sessionId, ["lead"]);
    }

    return NextResponse.json({
      success: true,
      lead: { id: lead.id, email: lead.email },
    });
  } catch (error) {
    console.error("Error saving lead:", error);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}
