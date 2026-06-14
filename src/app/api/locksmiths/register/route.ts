import { DEFAULT_CALLOUT_FEE } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { hashPassword, generateToken, AUTH_COOKIE_OPTIONS } from "@/lib/auth";
import { notifyNewLocksmith } from "@/lib/telegram";
import { sendLocksmithWelcomeEmail } from "@/lib/email";
import { isInUkOrIreland } from "@/lib/geo-guard";
import {
  extractUkPostcode,
  isCoordinatePair,
  normalizeUkPostcode,
  reverseGeocodePostcodeFromCoords,
} from "@/lib/location-display";

// POST - Locksmith registration
export async function POST(request: NextRequest) {
  try {
    const reqBody = await request.json();
    const {
      email,
      password,
      name,
      companyName,
      phone,
      baseLat,
      baseLng,
      baseAddress,
      coverageRadius,
    } = reqBody;

    // Phase 3, 2026-06-12: capture first-touch attribution from session history.
    const visitorId =
      (typeof reqBody.visitorId === "string" && reqBody.visitorId) ||
      request.cookies.get("ls_visitor_id")?.value ||
      null;

    // Validate required fields
    if (!email || !password || !name || !phone) {
      return NextResponse.json(
        { success: false, error: "All required fields must be provided" },
        { status: 400 }
      );
    }

    // Validate location (required for new registrations)
    if (!baseLat || !baseLng) {
      return NextResponse.json(
        { success: false, error: "Base location is required" },
        { status: 400 }
      );
    }

    // Restrict to UK + Ireland (incl. Crown Dependencies)
    const geoCheck = await isInUkOrIreland(Number(baseLat), Number(baseLng));
    if (!geoCheck.ok) {
      return NextResponse.json(
        { success: false, error: geoCheck.reason ?? "Location not supported" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingLocksmith = await prisma.locksmith.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingLocksmith) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = hashPassword(password);

    const cleanedBaseAddress = typeof baseAddress === "string" ? baseAddress.trim() : "";
    const extractedPostcode = normalizeUkPostcode(cleanedBaseAddress) ?? extractUkPostcode(cleanedBaseAddress);
    const reverseGeocodedPostcode = extractedPostcode
      ? extractedPostcode
      : await reverseGeocodePostcodeFromCoords(Number(baseLat), Number(baseLng));

    const persistedBaseAddress = reverseGeocodedPostcode
      ? reverseGeocodedPostcode
      : cleanedBaseAddress && !isCoordinatePair(cleanedBaseAddress)
        ? cleanedBaseAddress
        : null;

    // Create locksmith with first-touch attribution from session history
    // (Phase 3, 2026-06-12). Locksmith doesn't carry lastTouch* — recruitment
    // is a one-shot event; we only care where they first heard of us.
    const { stampFirstTouchOn } = await import("@/lib/attribution/touch-resolver");
    const locksmithBase = {
        email: email.toLowerCase(),
        passwordHash,
        name,
        companyName: companyName || null,
        phone,
        isActive: true,
        isVerified: false,
        rating: 5.0,
        totalJobs: 0,
        totalEarnings: 0,
        coverageAreas: [],
        services: [],
        yearsExperience: 0,
    };
    const locksmithDataStamped = await stampFirstTouchOn(
      locksmithBase,
      visitorId,
      { fallbackSource: "direct" },
    );
    const locksmith = await prisma.locksmith.create({
      data: {
        ...locksmithDataStamped,
        // Location & Coverage
        baseLat: baseLat,
        baseLng: baseLng,
        baseAddress: persistedBaseAddress,
        coverageRadius: coverageRadius || 10,
        // Sensible default so the call-out fee is never blank (never blocks
        // going Available). Editable in Settings.
        defaultAssessmentFee: DEFAULT_CALLOUT_FEE,
      },
    });

    // Send Telegram notification for new locksmith (non-blocking)
    notifyNewLocksmith({
      name: locksmith.name,
      email: locksmith.email,
      phone: locksmith.phone,
      companyName: locksmith.companyName,
      baseAddress: locksmith.baseAddress,
      basePostcode: reverseGeocodedPostcode,
      coverageRadius: locksmith.coverageRadius,
    }).catch(err => console.error("Failed to send Telegram notification:", err));

    // Send welcome email to new locksmith (non-blocking)
    sendLocksmithWelcomeEmail(locksmith.email, {
      locksmithName: locksmith.name,
      companyName: locksmith.companyName,
    }).catch(err => console.error("Failed to send welcome email:", err));

    // Generate JWT token for automatic login
    const token = generateToken({
      id: locksmith.id,
      email: locksmith.email,
      name: locksmith.name,
      companyName: locksmith.companyName,
      type: "locksmith",
    });

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      locksmith: {
        id: locksmith.id,
        email: locksmith.email,
        name: locksmith.name,
        companyName: locksmith.companyName,
        isVerified: locksmith.isVerified,
      },
    });

    // Set auth cookie
    response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Locksmith registration error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
