import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { generateToken, hashPassword, AUTH_COOKIE_OPTIONS, getRedirectPath } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { notifyNewCustomer, notifyNewJob } from "@/lib/telegram";
import { generateJobNumber } from "@/lib/job-number";

// Generate a random token
function generateRandomToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, password, pendingRequest } = body;

    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login instead." },
        { status: 409 }
      );
    }

    // Also check if this email exists in admin or locksmith tables
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() },
    });

    const existingLocksmith = await prisma.locksmith.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingAdmin || existingLocksmith) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Generate verification token
    const verificationToken = generateRandomToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create the customer
    const customer = await prisma.customer.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        passwordHash: hashPassword(password),
        emailVerified: false,
        verificationToken,
        verificationTokenExpiry,
      },
    });

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    // Send email (non-blocking)
    sendVerificationEmail(email.toLowerCase(), {
      customerName: name,
      verificationUrl,
    }).catch(err => console.error("Failed to send verification email:", err));

    // Send Telegram notification for new customer (non-blocking)
    notifyNewCustomer({
      name,
      email: email.toLowerCase(),
      phone,
    }).catch(err => console.error("Failed to send Telegram notification:", err));

    // If there's a pending request, create the job
    let createdJob = null;
    if (pendingRequest) {
      const jobNumber = await generateJobNumber(pendingRequest.postcode);

      createdJob = await prisma.job.create({
        data: {
          jobNumber,
          customerId: customer.id,
          problemType: pendingRequest.problemType,
          propertyType: pendingRequest.propertyType,
          postcode: pendingRequest.postcode,
          address: pendingRequest.address,
          description: pendingRequest.description || null,
        },
      });
    }

    // Generate token
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
      job: createdJob ? {
        id: createdJob.id,
        jobNumber: createdJob.jobNumber,
      } : null,
      redirectTo: createdJob ? `/customer/job/${createdJob.id}` : getRedirectPath("customer"),
    });

    response.cookies.set("auth_token", token, AUTH_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An error occurred during registration" },
      { status: 500 }
    );
  }
}
