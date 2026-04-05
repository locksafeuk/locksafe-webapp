import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, verifyPassword, AUTH_COOKIE_OPTIONS, getRedirectPath } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Try to find user in each table (Admin, Locksmith, Customer)

    // 1. Check Admin
    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (admin && admin.passwordHash && verifyPassword(password, admin.passwordHash)) {
      const token = generateToken({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        type: "admin",
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          type: "admin",
          role: admin.role,
        },
        redirectTo: getRedirectPath("admin"),
      });

      response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);
      return response;
    }

    // 2. Check Locksmith
    const locksmith = await prisma.locksmith.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (locksmith && locksmith.passwordHash && verifyPassword(password, locksmith.passwordHash)) {
      if (!locksmith.isActive) {
        return NextResponse.json(
          { error: "Your account has been deactivated. Please contact support." },
          { status: 403 }
        );
      }

      const token = generateToken({
        id: locksmith.id,
        email: locksmith.email,
        name: locksmith.name,
        companyName: locksmith.companyName,
        type: "locksmith",
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: locksmith.id,
          name: locksmith.name,
          email: locksmith.email,
          type: "locksmith",
          companyName: locksmith.companyName,
          isVerified: locksmith.isVerified,
        },
        redirectTo: getRedirectPath("locksmith"),
      });

      response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);
      return response;
    }

    // 3. Check Customer
    const customer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (customer && customer.passwordHash && verifyPassword(password, customer.passwordHash)) {
      const token = generateToken({
        id: customer.id,
        email: customer.email || "",
        name: customer.name,
        phone: customer.phone,
        type: "customer",
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          type: "customer",
          phone: customer.phone,
        },
        redirectTo: getRedirectPath("customer"),
      });

      response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);
      return response;
    }

    // No user found or password incorrect
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    );
  }
}
