import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { sendOnboardingCompleteEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";

/**
 * POST /api/onboarding/complete
 *
 * Complete customer onboarding after emergency payment.
 * Sets password, confirms location, marks onboarding complete.
 *
 * Input: {
 *   customerId: string,
 *   jobId: string,
 *   password: string,
 *   email: string, (required - collected during onboarding since not asked on phone)
 *   locationConfirmed: boolean,
 *   address?: string, (updated address if changed)
 *   postcode?: string (updated postcode if changed)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, jobId, password, email, locationConfirmed, address, postcode } = body;

    // Validate required fields
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Validate email - required during onboarding (not collected on phone)
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Email address is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.toLowerCase().trim();
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address format" },
        { status: 400 }
      );
    }

    // Check if email is already taken by another customer
    const existingEmailCustomer = await prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmailCustomer && existingEmailCustomer.id !== customerId) {
      return NextResponse.json(
        { success: false, error: "This email address is already associated with another account" },
        { status: 400 }
      );
    }

    // Find customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if already completed
    if (customer.onboardingCompleted && customer.passwordSet) {
      return NextResponse.json(
        { success: false, error: "Onboarding already completed" },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update customer - set email collected during onboarding
    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        email: normalizedEmail,
        passwordHash,
        passwordSet: true,
        locationConfirmed: locationConfirmed ?? true,
        onboardingCompleted: true,
        emailVerified: true,
        termsAcceptedAt: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    // Update job address if provided
    if (jobId && (address || postcode)) {
      const updateData: Record<string, unknown> = {};

      if (address) updateData.address = address;
      if (postcode) {
        updateData.postcode = postcode.toUpperCase();

        // Geocode new postcode
        try {
          const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase();
          const postcodeResponse = await fetch(
            `https://api.postcodes.io/postcodes/${cleanPostcode}`
          );
          const postcodeData = await postcodeResponse.json();

          if (postcodeData.status === 200 && postcodeData.result) {
            updateData.latitude = postcodeData.result.latitude;
            updateData.longitude = postcodeData.result.longitude;
          }
        } catch (error) {
          console.error("[Onboarding] Postcode lookup error:", error);
        }
      }

      await prisma.job.update({
        where: { id: jobId },
        data: updateData,
      });
    }

    // Create auth token and set cookie
    const authToken = generateToken({
      id: updatedCustomer.id,
      type: "customer",
      name: updatedCustomer.name,
      email: updatedCustomer.email || "",
      phone: updatedCustomer.phone,
    });

    const cookieStore = await cookies();
    cookieStore.set("auth_token", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    // Send confirmation email
    if (updatedCustomer.email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
      const job = jobId
        ? await prisma.job.findUnique({
            where: { id: jobId },
            select: { jobNumber: true },
          })
        : null;

      sendOnboardingCompleteEmail(updatedCustomer.email, {
        customerName: updatedCustomer.name,
        jobNumber: job?.jobNumber || "N/A",
        jobUrl: `${siteUrl}/customer/job/${jobId}`,
      }).catch((err) =>
        console.error("[Onboarding] Email error:", err)
      );
    }

    // Send SMS confirmation
    if (updatedCustomer.phone) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
      sendSMS(
        updatedCustomer.phone,
        `✅ LockSafe UK: Your account is ready! You can now track your locksmith and manage your jobs. Dashboard: ${siteUrl}/customer/dashboard`,
        { logContext: "Onboarding complete" }
      ).catch((err) =>
        console.error("[Onboarding] SMS error:", err)
      );
    }

    return NextResponse.json({
      success: true,
      message: "Onboarding complete",
      user: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        type: "customer",
      },
      ...(jobId ? { jobId } : {}),
    });
  } catch (error) {
    console.error("[API] Onboarding complete error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
