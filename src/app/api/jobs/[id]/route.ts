import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendLocksmithArrivedEmail } from "@/lib/email";
import { appendJobActivity } from "@/lib/job-activity";

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
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            senderType: true,
            senderName: true,
            body: true,
            isAdminMessage: true,
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

    await appendJobActivity({
      jobId: id,
      senderType: "admin",
      senderName: "Admin",
      message: "Job status updated: CANCELLED",
    }).catch((err) => {
      console.error("[Job DELETE] Failed to append activity log:", err);
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
    const {
      action,
      gpsData,
      status,
      problemType,
      propertyType,
      postcode,
      address,
    } = body;

    // Accept admin UI synthetic status and normalize it server-side.
    const normalizedStatus =
      status === "NO_LOCKSMITH_AVAILABLE" ? "CANCELLED" : status;

    const hasEditableFieldUpdates =
      typeof problemType === "string" ||
      typeof propertyType === "string" ||
      typeof postcode === "string" ||
      typeof address === "string";

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

      await appendJobActivity({
        jobId: id,
        senderType: "system",
        senderName: "System",
        message: `Job status updated: ${existingJob.status} -> ARRIVED`,
      }).catch((err) => {
        console.error("[Job PATCH] Failed to append activity log:", err);
      });

      // Send notification to customer when locksmith arrives
      if (updatedJob.customer?.email && updatedJob.locksmith) {
        try {
          await sendLocksmithArrivedEmail(updatedJob.customer.email, {
            customerName: updatedJob.customer.name,
            jobId: updatedJob.id,
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
    if (normalizedStatus) {
      const validStatuses = [
        "PHONE_INITIATED",
        "PENDING",
        "SCHEDULED",
        "ACCEPTED",
        "EN_ROUTE",
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

      if (!validStatuses.includes(normalizedStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid status",
            details: { receivedStatus: normalizedStatus },
          },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = { status: normalizedStatus };

      // Apply editable fields from admin modal in the same PATCH request.
      if (typeof problemType === "string") {
        updateData.problemType = problemType;
      }
      if (typeof propertyType === "string") {
        updateData.propertyType = propertyType;
      }
      if (typeof postcode === "string") {
        updateData.postcode = postcode;
      }
      if (typeof address === "string") {
        updateData.address = address;
      }

      // Preserve the admin's semantic "No Locksmith Available" status marker.
      if (status === "NO_LOCKSMITH_AVAILABLE") {
        if (!existingJob.noLocksmithNotifiedAt) {
          updateData.noLocksmithNotifiedAt = new Date();
        }
      } else if (normalizedStatus !== "CANCELLED") {
        // If job leaves cancelled state, clear no-locksmith marker fields.
        updateData.noLocksmithNotifiedAt = null;
        updateData.noLocksmithNotifiedChannels = [];
        updateData.noLocksmithNotifiedBy = null;
      }

      // Add timestamps based on status
      switch (normalizedStatus) {
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

      if (existingJob.status !== normalizedStatus) {
        await appendJobActivity({
          jobId: id,
          senderType: "admin",
          senderName: "Admin",
          message: `Job status updated: ${existingJob.status} -> ${normalizedStatus}`,
        }).catch((err) => {
          console.error("[Job PATCH] Failed to append activity log:", err);
        });
      }

      return NextResponse.json({
        success: true,
        job: updatedJob,
      });
    }

    // Handle non-status job edits from admin modal.
    if (hasEditableFieldUpdates) {
      const updateData: Record<string, unknown> = {};
      if (typeof problemType === "string") {
        updateData.problemType = problemType;
      }
      if (typeof propertyType === "string") {
        updateData.propertyType = propertyType;
      }
      if (typeof postcode === "string") {
        updateData.postcode = postcode;
      }
      if (typeof address === "string") {
        updateData.address = address;
      }

      const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          locksmith: true,
        },
      });

      await appendJobActivity({
        jobId: id,
        senderType: "admin",
        senderName: "Admin",
        message: "Job details updated by admin",
      }).catch((err) => {
        console.error("[Job PATCH] Failed to append activity log:", err);
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
