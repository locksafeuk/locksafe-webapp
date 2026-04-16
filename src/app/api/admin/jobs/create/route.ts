import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { verifyToken } from "@/lib/auth";
import { sendCustomerOnboardingEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { notifyNearbyLocksmiths } from "@/lib/job-notifications";
import crypto from "crypto";

// Generate unique job number
function generateJobNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `LRS-${year}${month}${day}-${random}`;
}

// Generate onboarding token
function generateOnboardingToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(authToken.value);
    if (!payload || payload.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      // Customer selection
      customerId, // Existing customer ID
      // New customer data (if no customerId)
      customerName,
      customerEmail,
      customerPhone,
      // Job details
      problemType,
      propertyType,
      urgency, // "emergency", "urgent", "scheduled"
      postcode,
      address,
      description,
      assessmentFee = 29.0,
    } = body;

    // Validate required fields
    if (!problemType || !propertyType || !postcode || !address) {
      return NextResponse.json(
        { error: "Missing required job details" },
        { status: 400 }
      );
    }

    if (!customerId && (!customerName || !customerPhone)) {
      return NextResponse.json(
        { error: "Customer name and phone are required for new customers" },
        { status: 400 }
      );
    }

    let customer;
    let isNewCustomer = false;
    let onboardingToken: string | null = null;

    // Get or create customer
    if (customerId) {
      // Use existing customer
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found" },
          { status: 404 }
        );
      }
    } else {
      // Check if customer exists by phone or email
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          OR: [
            { phone: customerPhone },
            customerEmail ? { email: customerEmail } : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
      });

      if (existingCustomer) {
        customer = existingCustomer;
      } else {
        // Create new customer
        isNewCustomer = true;
        onboardingToken = generateOnboardingToken();
        const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        customer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || null,
            createdVia: "admin",
            emailVerified: false,
            verificationToken: onboardingToken,
            verificationTokenExpiry: tokenExpiry,
            onboardingCompleted: false,
          },
        });
      }
    }

    // Get coordinates from postcode
    let latitude: number | null = null;
    let longitude: number | null = null;

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
      console.error("[Admin Create Job] Postcode lookup error:", error);
    }

    // Determine initial job status
    // If new customer needs onboarding, set to a pending state
    const initialStatus = isNewCustomer && !customer.onboardingCompleted
      ? JobStatus.PENDING
      : JobStatus.PENDING;

    // Create the job
    const job = await prisma.job.create({
      data: {
        jobNumber: generateJobNumber(),
        status: initialStatus,
        createdVia: "admin",
        customerId: customer.id,
        problemType,
        propertyType,
        postcode: postcode.toUpperCase(),
        address,
        description: description || null,
        latitude,
        longitude,
        assessmentFee,
        isEmergency: urgency === "emergency",
      },
      include: {
        customer: true,
      },
    });

    // Send notifications based on customer status
    if (isNewCustomer && customerEmail && onboardingToken) {
      // Send onboarding email to new customer
      const onboardingUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk"}/onboard/${onboardingToken}`;

      await sendCustomerOnboardingEmail(customerEmail, {
        customerName,
        jobNumber: job.jobNumber,
        jobAddress: `${address}, ${postcode}`,
        problemType,
        onboardingUrl,
      });

      console.log(`[Admin Create Job] Sent onboarding email to ${customerEmail}`);
    }

    // Send SMS notification to customer
    if (customer.phone) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";

      let smsMessage: string;
      if (isNewCustomer) {
        smsMessage = `LockSafe: Your locksmith job ${job.jobNumber} has been created. Complete your account setup to track your job: ${siteUrl}/onboard/${onboardingToken}`;
      } else {
        smsMessage = `LockSafe: Your locksmith job ${job.jobNumber} has been created. Track your job: ${siteUrl}/customer/job/${job.id}`;
      }

      sendSMS(customer.phone, smsMessage).catch((err) =>
        console.error("[Admin Create Job] SMS error:", err)
      );
    }

    // If customer is already onboarded, notify nearby locksmiths
    if (!isNewCustomer || customer.onboardingCompleted) {
      // Notify locksmiths in the area
      if (latitude && longitude) {
        notifyNearbyLocksmiths({
          id: job.id,
          jobNumber: job.jobNumber,
          problemType,
          propertyType,
          postcode: job.postcode,
          address: job.address,
          latitude,
          longitude,
        }).catch((err) =>
          console.error("[Admin Create Job] Error notifying locksmiths:", err)
        );
      }
    }

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          isNew: isNewCustomer,
          requiresOnboarding: isNewCustomer && !customer.onboardingCompleted,
        },
      },
      message: isNewCustomer
        ? "Job created. Customer will receive onboarding instructions."
        : "Job created successfully. Locksmiths have been notified.",
    });
  } catch (error) {
    console.error("[Admin Create Job] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// GET - Search for existing customers
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(authToken.value);
    if (!payload || payload.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    if (!search || search.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    // Search customers by name, email, or phone
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        onboardingCompleted: true,
        emailVerified: true,
        _count: {
          select: {
            jobs: true,
          },
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        onboardingCompleted: c.onboardingCompleted,
        emailVerified: c.emailVerified,
        jobCount: c._count.jobs,
      })),
    });
  } catch (error) {
    console.error("[Admin Create Job] Search error:", error);
    return NextResponse.json(
      { error: "Failed to search customers" },
      { status: 500 }
    );
  }
}
