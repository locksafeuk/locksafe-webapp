import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, verifyPassword, AUTH_COOKIE_OPTIONS, getRedirectPath } from "@/lib/auth";
import { enforceAuthRateLimit } from "@/lib/auth-rate-limit";
import { sendLocksmithFirstLoginInstallOptionsEmail } from "@/lib/email";
import { stampLastTouchOn } from "@/lib/attribution/touch-resolver";

/**
 * Pull the visitor id from request body (frontend includes it) or the
 * ls_visitor_id backup cookie. Returns null when neither present.
 */
function resolveVisitorId(
  request: NextRequest,
  bodyVisitorId: unknown,
): string | null {
  if (typeof bodyVisitorId === "string" && bodyVisitorId.length > 0) {
    return bodyVisitorId;
  }
  const cookie = request.cookies.get("ls_visitor_id")?.value;
  return cookie && cookie.length > 0 ? cookie : null;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitedResponse = enforceAuthRateLimit(request, "auth-login");
    if (rateLimitedResponse) {
      return rateLimitedResponse;
    }

    const body = await request.json();
    const { email, password } = body;
    const visitorId = resolveVisitorId(request, body.visitorId);

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

      await prisma.locksmith.update({
        where: { id: locksmith.id },
        data: { onboardingLastInteractionAt: new Date() },
        select: { id: true },
      });

      const firstLoginUpdate = await prisma.locksmith.updateMany({
        where: {
          id: locksmith.id,
          OR: [
            { firstLocksmithLoginAt: null },
            { firstLocksmithLoginAt: { isSet: false } },
          ],
        },
        data: {
          firstLocksmithLoginAt: new Date(),
        },
      });

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

      // Send one-time post-first-login setup email (non-blocking).
      if (firstLoginUpdate.count > 0) {
        sendLocksmithFirstLoginInstallOptionsEmail(sanitizedLocksmithEmail, {
          locksmithName: sanitizedLocksmithName,
        }).catch((error) => {
          console.error("Failed to send first-login locksmith email:", error);
        });
      }

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

      // Phase 3, 2026-06-12: refresh lastTouch* from the current visitor
      // session. Non-blocking: failure to stamp must not break login.
      try {
        const update = await stampLastTouchOn({}, visitorId);
        if (Object.keys(update).length > 0) {
          await prisma.customer.update({
            where: { id: customer.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: update as any,
          });
        }
      } catch (err) {
        console.warn(
          "[auth/login] lastTouch stamp failed:",
          err instanceof Error ? err.message : err,
        );
      }

      // Phase B, 2026-06-12: link this visitor's UserSession rows to the
      // customer so analytics joins (UserSession ↔ Customer) work without
      // visitorId-matching gymnastics.
      if (visitorId) {
        try {
          // NB: MongoDB connector treats `customerId: null` filter strictly
          // (matches literal null, not missing field). Filter on visitorId
          // only — claim every session for this visitor.
          await prisma.userSession.updateMany({
            where: { visitorId },
            data:  { customerId: customer.id },
          });
        } catch (err) {
          console.warn(
            "[auth/login] UserSession.customerId link failed:",
            err instanceof Error ? err.message : err,
          );
        }
      }

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
