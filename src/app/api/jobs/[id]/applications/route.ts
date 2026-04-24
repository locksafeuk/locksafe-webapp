import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { sendLocksmithApplicationNotification } from "@/lib/email";
import { notifyLocksmithApplication } from "@/lib/telegram";

// GET - Get all applications for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const applications = await prisma.locksmithApplication.findMany({
      where: { jobId: id },
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            companyName: true,
            rating: true,
            totalJobs: true,
            isVerified: true,
            yearsExperience: true,
            profileImage: true,
            stripeConnectId: true,
            stripeConnectOnboarded: true,
            stripeConnectVerified: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      applications: applications.map((app) => ({
        id: app.id,
        assessmentFee: app.assessmentFee,
        eta: app.eta,
        message: app.message,
        status: app.status,
        appliedAt: app.createdAt,
        locksmith: {
          id: app.locksmith.id,
          name: app.locksmith.name,
          company: app.locksmith.companyName,
          rating: app.locksmith.rating,
          reviewCount: app.locksmith.totalJobs,
          verified: app.locksmith.isVerified,
          yearsExperience: app.locksmith.yearsExperience,
          avatar: app.locksmith.name
            .split(" ")
            .map((n) => n[0])
            .join(""),
          profileImage: app.locksmith.profileImage,
          stripeConnected: !!app.locksmith.stripeConnectId && app.locksmith.stripeConnectVerified,
          stripeAccountId: app.locksmith.stripeConnectId,
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}

// POST - Locksmith applies for a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { locksmithId, assessmentFee, eta, message } = body;

    if (!locksmithId || !assessmentFee || !eta) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check locksmith exists and has valid insurance
    const locksmith = await prisma.locksmith.findUnique({
      where: { id: locksmithId },
      select: {
        id: true,
        name: true,
        companyName: true,
        phone: true,
        rating: true,
        insuranceStatus: true,
        insuranceExpiryDate: true,
        insuranceDocumentUrl: true,
        isVerified: true,
        isActive: true,
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Block if insurance is expired
    if (locksmith.insuranceStatus === "expired") {
      return NextResponse.json(
        {
          success: false,
          error: "Your insurance has expired. Please update your insurance certificate before applying for jobs.",
          errorCode: "INSURANCE_EXPIRED"
        },
        { status: 403 }
      );
    }

    // Double-check expiry date (in case status wasn't updated)
    if (locksmith.insuranceExpiryDate) {
      const expiryDate = new Date(locksmith.insuranceExpiryDate);
      if (expiryDate < new Date()) {
        // Update the status to expired
        await prisma.locksmith.update({
          where: { id: locksmithId },
          data: { insuranceStatus: "expired" },
        });

        return NextResponse.json(
          {
            success: false,
            error: "Your insurance has expired. Please update your insurance certificate before applying for jobs.",
            errorCode: "INSURANCE_EXPIRED"
          },
          { status: 403 }
        );
      }
    }

    // Block if no insurance document uploaded
    if (!locksmith.insuranceDocumentUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Please upload your insurance certificate before applying for jobs.",
          errorCode: "INSURANCE_MISSING"
        },
        { status: 403 }
      );
    }

    // Check if job exists and is pending
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.status !== JobStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: "Job is no longer available" },
        { status: 400 }
      );
    }

    // Check if locksmith already applied
    const existingApplication = await prisma.locksmithApplication.findUnique({
      where: {
        jobId_locksmithId: {
          jobId: id,
          locksmithId,
        },
      },
    });

    if (existingApplication) {
      return NextResponse.json(
        { success: false, error: "You have already applied for this job" },
        { status: 400 }
      );
    }

    // Create application
    const application = await prisma.locksmithApplication.create({
      data: {
        jobId: id,
        locksmithId,
        assessmentFee,
        eta,
        message,
        status: "pending",
      },
      include: {
        locksmith: true,
      },
    });

    // Send email notification to customer (non-blocking)
    if (job.customer?.email) {
      sendLocksmithApplicationNotification(job.customer.email, {
        customerName: job.customer.name,
        jobId: job.id,
        jobNumber: job.jobNumber,
        locksmithName: application.locksmith.name,
        assessmentFee,
        eta,
        rating: application.locksmith.rating,
      }).catch((err) => console.error("[Email] Failed to send application notification:", err));
    }

    // Send Telegram notification (non-blocking)
    notifyLocksmithApplication({
      jobNumber: job.jobNumber,
      jobId: job.id,
      locksmithName: application.locksmith.name,
      locksmithCompany: application.locksmith.companyName,
      locksmithPhone: application.locksmith.phone,
      customerName: job.customer?.name || "Customer",
      estimatedArrival: `${eta} minutes`,
    }).catch((err) => console.error("[Telegram] Failed to send application notification:", err));

    return NextResponse.json({
      success: true,
      application: {
        id: application.id,
        assessmentFee: application.assessmentFee,
        eta: application.eta,
        status: application.status,
      },
    });
  } catch (error) {
    console.error("Error creating application:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
