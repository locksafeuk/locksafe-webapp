import { NextRequest, NextResponse } from "next/server";
import { trackModalInteraction, shouldShowModal } from "@/lib/marketing/tracker";

// GET - Check if modal should be shown
export async function GET(request: NextRequest) {
  try {
    const visitorId = request.nextUrl.searchParams.get("visitorId");
    const modalType = request.nextUrl.searchParams.get("modalType");
    const cooldownHours = parseInt(
      request.nextUrl.searchParams.get("cooldownHours") || "24"
    );
    const maxShows = parseInt(
      request.nextUrl.searchParams.get("maxShows") || "1"
    );

    if (!visitorId || !modalType) {
      return NextResponse.json(
        { error: "Visitor ID and modal type required" },
        { status: 400 }
      );
    }

    const canShow = await shouldShowModal(
      visitorId,
      modalType,
      cooldownHours,
      maxShows
    );

    return NextResponse.json({ canShow });
  } catch (error) {
    console.error("Error checking modal:", error);
    return NextResponse.json(
      { error: "Failed to check modal" },
      { status: 500 }
    );
  }
}

// POST - Track modal interaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      visitorId,
      sessionId,
      modalType,
      action,
      data,
      triggerId,
      customerId,
    } = body;

    if (!visitorId || !sessionId || !modalType || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    await trackModalInteraction(
      visitorId,
      sessionId,
      modalType,
      action,
      data,
      triggerId,
      customerId
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking modal:", error);
    return NextResponse.json(
      { error: "Failed to track modal" },
      { status: 500 }
    );
  }
}
