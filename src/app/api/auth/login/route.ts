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

    // Sanitize email input - trim whitespace and lowercase
    const sanitizedEmail = email.trim().toLowerCase();

    // 1. Check Admin
    const admin = await prisma.admin.findUnique({
      where: { email: sanitizedEmail },
    });

    if (admin && admin.passwordHash && verifyPassword(password, admin.passwordHash)) {
      // Sanitize string fields before generating token
      const sanitizedName = admin.name?.trim() || "";
      const sanitizedAdminEmail = admin.email?.trim().toLowerCase() || "";

      const token = generateToken({
        id: admin.id,
        email: sanitizedAdminEmail,
        name: sanitizedName,
        role: admin.role,
        type: "admin",
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: admin.id,
          name: sanitizedName,
          email: sanitizedAdminEmail,
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
      where: { email: sanitizedEmail },
    });

    if (locksmith && locksmith.passwordHash && verifyPassword(password, locksmith.passwordHash)) {
      if (!locksmith.isActive) {
        return NextResponse.json(
          { error: "Your account has been deactivated. Please contact support." },
          { status: 403 }
        );
      }

      // Sanitize string fields before generating token
      const sanitizedLocksmithName = locksmith.name?.trim() || "";
      const sanitizedLocksmithEmail = locksmith.email?.trim().toLowerCase() || "";
      const sanitizedCompanyName = locksmith.companyName?.trim() || null;

      const token = generateToken({
        id: locksmith.id,
        email: sanitizedLocksmithEmail,
        name: sanitizedLocksmithName,
        companyName: sanitizedCompanyName,
        type: "locksmith",
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: locksmith.id,
          name: sanitizedLocksmithName,
          email: sanitizedLocksmithEmail,
          type: "locksmith",
          companyName: sanitizedCompanyName,
          isVerified: locksmith.isVerified,
        },
        redirectTo: getRedirectPath("locksmith"),
      });

      response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);
      return response;
    }

    // 3. Check Customer
    const customer = await prisma.customer.findUnique({
      where: { email: sanitizedEmail },
    });

    if (customer && customer.passwordHash && verifyPassword(password, customer.passwordHash)) {
      // Sanitize string fields before generating token
      const sanitizedCustomerName = customer.name?.trim() || "";
      const sanitizedCustomerEmail = customer.email?.trim().toLowerCase() || "";
      const sanitizedPhone = customer.phone?.trim() || "";

      const token = generateToken({
        id: customer.id,
        email: sanitizedCustomerEmail,
        name: sanitizedCustomerName,
        phone: sanitizedPhone,
        type: "customer",
      });

      const response = NextResponse.json({
        success: true,
        user: {
          id: customer.id,
          name: sanitizedCustomerName,
          email: sanitizedCustomerEmail,
          type: "customer",
          phone: sanitizedPhone,
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
