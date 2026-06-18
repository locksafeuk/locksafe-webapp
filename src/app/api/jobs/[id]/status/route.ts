import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendWorkCompletionConfirmationEmail, sendLocksmithArrivedEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { SITE_URL } from "@/lib/config";
import { notifyLocksmithArrived, notifyWorkCompleted } from "@/lib/telegram";
import {
  sendJobNotification,
  notifyCustomerLocksmithEnRoute,
  type JobSMSContext,
} from "@/lib/sms";
import { appendJobActivity } from "@/lib/job-activity";
import { validateStatusTransition, statusRequiresLocksmith } from "@/lib/job-status-machine";

// PATCH - Update job status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, gpsData, eta, override } = body;
    const normalizedStatus =
      status === "NO_LOCKSMITH_AVAILABLE" ? "CANCELLED" : status;

    if (!normalizedStatus) {
      return NextResponse.json(
        { success: false, error: "Status is required" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = [
      "PENDING",
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
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    // Get the job first to check current status and get customer info
    const existingJob = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        locksmith: true,
        quote: true,
      },
    });

    if (!existingJob) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Enforce the locksmith invariant: a job cannot advance to ACCEPTED or any
    // later state without an assigned locksmith. Prevents the COMPLETED/SIGNED-
    // with-no-locksmith corruption. Admins may pass override:true to force.
    const transition = validateStatusTransition(normalizedStatus, {
      hasLocksmith: !!existingJob.locksmithId,
      override: override === true,
    });
    if (!transition.ok) {
      return NextResponse.json(
        { success: false, error: transition.error },
        { status: 409 }
      );
    }
    if (override === true && statusRequiresLocksmith(normalizedStatus) && !existingJob.locksmithId) {
      console.warn(
        `[Job Status] OVERRIDE: ${existingJob.jobNumber ?? id} forced to ${normalizedStatus} with no locksmith assigned.`,
      );
    }

    // Build update data based on status
    const updateData: Record<string, unknown> = { status: normalizedStatus };

    if (status === "NO_LOCKSMITH_AVAILABLE") {
      if (!existingJob.noLocksmithNotifiedAt) {
        updateData.noLocksmithNotifiedAt = new Date();
      }
    } else if (normalizedStatus !== "CANCELLED") {
      updateData.noLocksmithNotifiedAt = null;
      updateData.noLocksmithNotifiedChannels = [];
      updateData.noLocksmithNotifiedBy = null;
    }

    switch (normalizedStatus) {
      case "ACCEPTED":
        updateData.acceptedAt = new Date();
        break;
      case "EN_ROUTE":
        updateData.enRouteAt = new Date();
        if (eta) {
          updateData.estimatedArrival = eta;
        }
        break;
      case "ARRIVED":
        updateData.arrivedAt = new Date();
        if (gpsData) {
          updateData.arrivalGps = gpsData;
        }
        break;
      case "DIAGNOSING":
        updateData.diagnosedAt = new Date();
        break;
      case "IN_PROGRESS":
        updateData.workStartedAt = new Date();
        if (gpsData) {
          updateData.workStartedGps = gpsData;
        }
        break;
      case "PENDING_CUSTOMER_CONFIRMATION":
        // Locksmith marks work as complete - waiting for customer confirmation
        updateData.workCompletedAt = new Date();
        // Set 24-hour deadline for customer to sign
        updateData.confirmationDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        updateData.confirmationRemindersSent = 0;
        if (gpsData) {
          updateData.completionGps = gpsData;
        }
        break;
      case "COMPLETED":
        if (!existingJob.workCompletedAt) {
          updateData.workCompletedAt = new Date();
        }
        if (gpsData && !existingJob.completionGps) {
          updateData.completionGps = gpsData;
        }
        break;
      case "SIGNED":
        updateData.signedAt = new Date();
        break;
    }

    const job = await prisma.job.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        locksmith: true,
        quote: true,
      },
    });

    if (existingJob.status !== normalizedStatus) {
      await appendJobActivity({
        jobId: job.id,
        senderType: "system",
        senderName: "System",
        message: `Job status updated: ${existingJob.status} -> ${normalizedStatus}`,
      }).catch((err) => {
        console.error("[Job Status] Failed to append activity log:", err);
      });
    }

    // ── Server-side Google Ads conversion upload ──────────────────────────
    // 2026-06-13 fix: the two Stripe payment webhooks were the ONLY callers
    // of uploadJobConversionIfEligible(). A job completed via THIS status
    // route (locksmith marks work done) therefore never attempted an upload —
    // the attribution diagnostic showed completed jobs stuck at
    // conversionUploadStatus="never_attempted", so the macro "Job Completed"
    // conversion never reached Google and Maximize-Conversions had no signal.
    //
    // Fire-and-forget on a real completion transition. The uploader is
    // idempotent: it self-skips when already uploaded (skipped_already_uploaded)
    // and when there is no gclid on the job or its CallIntent (skipped_no_gclid),
    // so calling it on every COMPLETED/SIGNED transition is safe and cannot
    // double-count or upload non-Google traffic.
    if (
      existingJob.status !== normalizedStatus &&
      (normalizedStatus === "COMPLETED" || normalizedStatus === "SIGNED")
    ) {
      import("@/lib/google-ads-conversions")
        .then(({ uploadJobConversionIfEligible }) =>
          uploadJobConversionIfEligible(job.id),
        )
        .then((r) =>
          console.log(
            `[Job Status] Google Ads conversion upload for ${job.jobNumber}: ${r.status}`,
          ),
        )
        .catch((err) =>
          console.error("[Job Status] conversion upload trigger failed:", err),
        );
    }

    // Build SMS context for notifications
    const smsContext: JobSMSContext = {
      jobId: job.id,
      jobNumber: job.jobNumber,
      customerName: job.customer?.name || "Customer",
      customerPhone: job.customer?.phone || "",
      locksmithName: job.locksmith?.name,
      locksmithPhone: job.locksmith?.phone || undefined,
      problemType: job.problemType,
      postcode: job.postcode || undefined,
      address: job.address || undefined,
      eta: eta || job.estimatedArrival || undefined,
      assessmentFee: job.assessmentFee ?? undefined,
      quotedAmount: job.quote?.total,
      finalAmount: job.quote?.total || job.assessmentFee || undefined,
    };

    // Send SMS notification when locksmith is en route
    if (normalizedStatus === "EN_ROUTE" && job.customer?.phone && job.locksmith) {
      notifyCustomerLocksmithEnRoute(smsContext).catch((err) =>
        console.error("[SMS] Failed to send en-route notification:", err)
      );

    }

    // Send notification to customer when locksmith arrives
    if (normalizedStatus === "ARRIVED" && job.customer?.email && job.locksmith) {
      // Send SMS notification
      sendJobNotification("arrived", smsContext).catch((err) =>
        console.error("[SMS] Failed to send arrival notification:", err)
      );

      // Create in-app notification
      try {
        await createNotification({
          customerId: job.customerId,
          jobId: job.id,
          type: "locksmith_arrived",
          title: "Locksmith Arrived",
          message: `${job.locksmith.name} has arrived at your location for job ${job.jobNumber}.`,
          actionUrl: `/customer/job/${job.id}`,
          actionLabel: "View Job",
        });
      } catch (notifError) {
        console.error("[Job Status] Failed to create arrival notification:", notifError);
      }

      // Send email
      try {
        await sendLocksmithArrivedEmail(job.customer.email, {
          customerName: job.customer.name,
          jobId: job.id,
          jobNumber: job.jobNumber,
          locksmithName: job.locksmith.name,
          locksmithPhone: job.locksmith.phone || "",
          address: job.address,
        });
        console.log(`[Job Status] Sent locksmith arrived email to ${job.customer.email}`);
      } catch (emailError) {
        console.error("[Job Status] Failed to send arrived email:", emailError);
      }

      // Send Telegram notification (non-blocking)
      notifyLocksmithArrived({
        jobNumber: job.jobNumber,
        jobId: job.id,
        locksmithName: job.locksmith.name,
        customerName: job.customer.name,
        address: job.address,
      }).catch((err) => console.error("[Telegram] Failed to send arrival notification:", err));

    }

    // Send SMS when work starts
    if (normalizedStatus === "IN_PROGRESS" && job.customer?.phone && job.locksmith) {
      sendJobNotification("work_started", smsContext).catch((err) =>
        console.error("[SMS] Failed to send work started notification:", err)
      );
    }

    // Send notification to customer when locksmith marks work as complete
    if (normalizedStatus === "PENDING_CUSTOMER_CONFIRMATION" && job.customer?.email && job.locksmith) {
      const baseUrl = request.headers.get("origin") || request.headers.get("host") || SITE_URL;
      const confirmationUrl = `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/customer/job/${job.id}`;
      const quoteTotal = job.quote?.total || job.assessmentFee || 0;

      // Send SMS notification to customer
      sendJobNotification("work_completed", {
        ...smsContext,
        finalAmount: quoteTotal,
      }).catch((err) =>
        console.error("[SMS] Failed to send work completed notification:", err)
      );

      // Create in-app notification for customer
      try {
        await createNotification({
          customerId: job.customerId,
          jobId: job.id,
          type: "work_completed",
          title: "Work Completed - Please Sign",
          message: `${job.locksmith.name} has completed the work. Please confirm and sign to process payment of £${quoteTotal.toFixed(2)}.`,
          actionUrl: `/customer/job/${job.id}`,
          actionLabel: "Sign Now",
          data: {
            quoteTotal,
            locksmithName: job.locksmith.name,
            deadline: (updateData.confirmationDeadline as Date).toISOString(),
          },
        });
      } catch (notifError) {
        console.error("[Job Status] Failed to create work completion notification:", notifError);
      }

      // Create in-app notification for locksmith
      try {
        await createNotification({
          locksmithId: job.locksmithId || undefined,
          jobId: job.id,
          type: "job_update",
          title: "Awaiting Customer Signature",
          message: `Work marked complete for job ${job.jobNumber}. The customer has 24 hours to confirm and sign.`,
          actionUrl: `/locksmith/job/${job.id}/work`,
          actionLabel: "View Job",
        });
      } catch (notifError) {
        console.error("[Job Status] Failed to create locksmith notification:", notifError);
      }

      // Send email to customer
      try {
        await sendWorkCompletionConfirmationEmail(job.customer.email, {
          customerName: job.customer.name,
          jobNumber: job.jobNumber,
          jobId: job.id,
          locksmithName: job.locksmith.name,
          quoteTotal: quoteTotal,
          address: job.address,
          confirmationUrl,
        });
        console.log(`[Job Status] Sent work completion confirmation email to ${job.customer.email}`);
      } catch (emailError) {
        console.error("[Job Status] Failed to send confirmation email:", emailError);
      }

      // Send Telegram notification (non-blocking)
      notifyWorkCompleted({
        jobNumber: job.jobNumber,
        jobId: job.id,
        locksmithName: job.locksmith.name,
        customerName: job.customer.name,
        total: quoteTotal,
      }).catch((err) => console.error("[Telegram] Failed to send work completed notification:", err));

    }

    // Send SMS when customer signs/confirms
    if (normalizedStatus === "SIGNED" && job.locksmith?.phone) {
      sendJobNotification("job_signed", smsContext).catch((err) =>
        console.error("[SMS] Failed to send job signed notification:", err)
      );
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error("Error updating job status:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update job status" },
      { status: 500 }
    );
  }
}
