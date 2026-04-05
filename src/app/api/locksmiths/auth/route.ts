import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, verifyPassword, AUTH_COOKIE_OPTIONS } from "@/lib/auth";

// POST - Locksmith login
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const locksmith = await prisma.locksmith.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!locksmith || !locksmith.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!locksmith.passwordHash || !verifyPassword(password, locksmith.passwordHash)) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token
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
        rating: locksmith.rating,
        totalJobs: locksmith.totalJobs,
        isVerified: locksmith.isVerified,
        coverageAreas: locksmith.coverageAreas,
        stripeConnectOnboarded: locksmith.stripeConnectOnboarded,
      },
    });

    // Set auth cookie
    response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Locksmith login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}

// DELETE - Locksmith logout
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  return response;
}

// GET - Check current session
export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 }
    );
  }

  const { verifyToken } = await import("@/lib/auth");
  const payload = verifyToken(token);

  if (!payload || payload.type !== "locksmith") {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 }
    );
  }

  // Fetch fresh locksmith data
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      name: true,
      companyName: true,
      rating: true,
      totalJobs: true,
      isVerified: true,
      coverageAreas: true,
      stripeConnectOnboarded: true,
    },
  });

  if (!locksmith) {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    locksmith,
  });
}
