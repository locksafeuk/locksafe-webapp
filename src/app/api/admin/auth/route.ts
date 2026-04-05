import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, verifyPassword, AUTH_COOKIE_OPTIONS } from "@/lib/auth";

// POST - Admin login
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, admin.passwordHash)) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      type: "admin",
    });

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });

    // Set auth cookie
    response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}

// DELETE - Admin logout
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

  if (!payload || payload.type !== "admin") {
    return NextResponse.json(
      { success: false, authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    admin: {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    },
  });
}
