import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendLocksmithArrivedEmail } from "@/lib/email";

// GET - Get a single job by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            stripeCustomerId: true,
            stripePaymentMethodId: true,
          },
        },
        locksmith: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            companyName: true,
            rating: true,
            isVerified: true,
            profileImage: true,
            stripeConnectId: true,
            stripeConnectVerified: true,
          },
        },
        quote: true,
        signature: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        photos: {
          orderBy: { takenAt: "asc" },
          select: {
            id: true,
            url: true,
            type: true,
            caption: true,
            takenAt: true,
            gpsLat: true,
            gpsLng: true,
          },
        },
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Only allow cancellation of pending or accepted jobs
    if (!["PENDING", "ACCEPTED"].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: "Job cannot be cancelled in its current status" },
        { status: 400 }
      );
    }

    // Update job status to cancelled
    await prisma.job.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    console.error("Error cancelling job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}

// PATCH - Update job (for actions like arrive, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, gpsData, status } = body;

    // Get the job first
    const existingJob = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        locksmith: true,
      },
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Handle different actions
    if (action === "arrive") {
      // Update job status to ARRIVED with GPS data
      const updatedJob = await prisma.job.update({
        where: { id },
        data: {
          status: "ARRIVED",
          arrivedAt: new Date(),
          arrivalGps: gpsData || null,
        },
        include: {
          customer: true,
          locksmith: true,
        },
      });

      // Send notification to customer when locksmith arrives
      if (updatedJob.customer?.email && updatedJob.locksmith) {
        try {
          await sendLocksmithArrivedEmail(updatedJob.customer.email, {
            customerName: updatedJob.customer.name,
            jobNumber: updatedJob.jobNumber,
            locksmithName: updatedJob.locksmith.name,
            locksmithPhone: updatedJob.locksmith.phone || "",
            address: updatedJob.address,
          });
          console.log(`[Job PATCH] Sent locksmith arrived email to ${updatedJob.customer.email}`);
        } catch (emailError) {
          console.error("[Job PATCH] Failed to send arrived email:", emailError);
          // Don't fail the request if email fails
        }
      }

      return NextResponse.json({
        success: true,
        job: updatedJob,
      });
    }

    // Handle direct status updates
    if (status) {
      const validStatuses = [
        "PENDING",
        "ACCEPTED",
        "ARRIVED",
        "DIAGNOSING",
        "QUOTED",
        "QUOTE_ACCEPTED",
        "QUOTE_DECLINED",
        "IN_PROGRESS",
        "PENDING_CUSTOMER_CONFIRMATION",
        "COMPLETED",
        "SIGNED",
        "CANCELLED",
      ];

      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: "Invalid status" },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = { status };

      // Add timestamps based on status
      switch (status) {
        case "ARRIVED":
          updateData.arrivedAt = new Date();
          if (gpsData) updateData.arrivalGps = gpsData;
          break;
        case "DIAGNOSING":
          updateData.diagnosedAt = new Date();
          break;
        case "IN_PROGRESS":
          updateData.workStartedAt = new Date();
          break;
        case "PENDING_CUSTOMER_CONFIRMATION":
        case "COMPLETED":
          updateData.workCompletedAt = new Date();
          if (gpsData) updateData.completionGps = gpsData;
          break;
        case "SIGNED":
          updateData.signedAt = new Date();
          break;
      }

      const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          locksmith: true,
        },
      });

      return NextResponse.json({
        success: true,
        job: updatedJob,
      });
    }

    return NextResponse.json(
      { success: false, error: "No valid action or status provided" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update job" },
      { status: 500 }
    );
  }
}
