import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { sendOnboardingCompleteEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";

// GET - Fetch onboarding data using token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Find customer with this verification token
    const customer = await prisma.customer.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired onboarding link" },
        { status: 404 }
      );
    }

    // Check if already onboarded
    if (customer.onboardingCompleted) {
      return NextResponse.json(
        { success: false, error: "Account has already been set up" },
        { status: 400 }
      );
    }

    // Find the most recent pending job for this customer
    const job = await prisma.job.findFirst({
      where: {
        customerId: customer.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "No pending job found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        job: {
          id: job.id,
          jobNumber: job.jobNumber,
          problemType: job.problemType,
          propertyType: job.propertyType,
          address: job.address,
          postcode: job.postcode,
        },
      },
    });
  } catch (error) {
    console.error("[Onboarding] GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch onboarding data" },
      { status: 500 }
    );
  }
}

// POST - Complete onboarding
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, address, postcode } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Find customer with this verification token
    const customer = await prisma.customer.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired onboarding link" },
        { status: 404 }
      );
    }

    // Check if already onboarded
    if (customer.onboardingCompleted) {
      return NextResponse.json(
        { success: false, error: "Account has already been set up" },
        { status: 400 }
      );
    }

    // Find the most recent pending job for this customer
    const job = await prisma.job.findFirst({
      where: {
        customerId: customer.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "No pending job found" },
        { status: 404 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12);

    // Get coordinates if address was updated
    let latitude = job.latitude;
    let longitude = job.longitude;

    if (postcode && postcode !== job.postcode) {
      try {
        const cleanPostcode = postcode.replace(/\s/g, "").toUpperCase();
        const postcodeResponse = await fetch(
          `https://api.postcodes.io/postcodes/${cleanPostcode}`
        );
        const postcodeData = await postcodeResponse.json();

        if (postcodeData.status === 200 && postcodeData.result) {
          latitude = postcodeData.result.latitude;
          longitude = postcodeData.result.longitude;
        }
      } catch (error) {
        console.error("[Onboarding] Postcode lookup error:", error);
      }
    }

    // Update customer
    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordHash,
        emailVerified: true,
        onboardingCompleted: true,
        verificationToken: null,
        verificationTokenExpiry: null,
        termsAcceptedAt: new Date(),
      },
    });

    // Update job address if changed
    if (address || postcode) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          address: address || job.address,
          postcode: postcode?.toUpperCase() || job.postcode,
          latitude,
          longitude,
        },
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

    // Send onboarding complete email
    if (customer.email) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
      sendOnboardingCompleteEmail(customer.email, {
        customerName: customer.name,
        jobNumber: job.jobNumber,
        jobUrl: `${siteUrl}/customer/job/${job.id}`,
      }).catch((err) =>
        console.error("[Onboarding] Failed to send completion email:", err)
      );
    }

    // Send SMS notification
    if (customer.phone) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";
      const smsMessage = `LockSafe: Your account is set up! Your job ${job.jobNumber} is now active. Track your locksmith: ${siteUrl}/customer/job/${job.id}`;

      sendSMS(customer.phone, smsMessage).catch((err) =>
        console.error("[Onboarding] Failed to send SMS:", err)
      );
    }

    // Notify nearby locksmiths now that customer is onboarded
    const finalLatitude = latitude || job.latitude;
    const finalLongitude = longitude || job.longitude;

    if (finalLatitude && finalLongitude) {
      notifyNearbyLocksmiths({
        id: job.id,
        jobNumber: job.jobNumber,
        problemType: job.problemType,
        propertyType: job.propertyType,
        postcode: postcode?.toUpperCase() || job.postcode,
        address: address || job.address,
        latitude: finalLatitude,
        longitude: finalLongitude,
      }).catch((err) =>
        console.error("[Onboarding] Error notifying locksmiths:", err)
      );
    }

    return NextResponse.json({
      success: true,
      message: "Onboarding complete",
      jobId: job.id,
      user: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        email: updatedCustomer.email,
        type: "customer",
      },
    });
  } catch (error) {
    console.error("[Onboarding] POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
