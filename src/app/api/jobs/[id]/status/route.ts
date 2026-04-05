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
import {
  sendCustomerPushNotification,
  sendLocksmithPushNotification,
} from "@/lib/job-notifications";

// PATCH - Update job status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, gpsData, eta } = body;

    if (!status) {
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

    if (!validStatuses.includes(status)) {
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

    // Build update data based on status
    const updateData: Record<string, unknown> = { status };

    switch (status) {
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
      assessmentFee: job.assessmentFee,
      quotedAmount: job.quote?.total,
      finalAmount: job.quote?.total || job.assessmentFee,
    };

    // Send SMS notification when locksmith is en route
    if (status === "EN_ROUTE" && job.customer?.phone && job.locksmith) {
      notifyCustomerLocksmithEnRoute(smsContext).catch((err) =>
        console.error("[SMS] Failed to send en-route notification:", err)
      );

      // Send OneSignal push notification to customer
      sendCustomerPushNotification(job.customerId, "LOCKSMITH_EN_ROUTE", {
        jobId: job.id,
        variables: {
          eta: eta || job.estimatedArrival || "soon",
        },
      }).catch((err) =>
        console.error("[Push] Failed to send en-route push notification:", err)
      );
    }

    // Send notification to customer when locksmith arrives
    if (status === "ARRIVED" && job.customer?.email && job.locksmith) {
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

      // Send OneSignal push notification to customer
      sendCustomerPushNotification(job.customerId, "LOCKSMITH_ARRIVED", {
        jobId: job.id,
      }).catch((err) =>
        console.error("[Push] Failed to send arrival push notification:", err)
      );
    }

    // Send SMS when work starts
    if (status === "IN_PROGRESS" && job.customer?.phone && job.locksmith) {
      sendJobNotification("work_started", smsContext).catch((err) =>
        console.error("[SMS] Failed to send work started notification:", err)
      );
    }

    // Send notification to customer when locksmith marks work as complete
    if (status === "PENDING_CUSTOMER_CONFIRMATION" && job.customer?.email && job.locksmith) {
      const baseUrl = request.headers.get("origin") || request.headers.get("host") || SITE_URL;
      const confirmationUrl = `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/customer/job/${job.id}`;
      const quoteTotal = job.quote?.total || job.assessmentFee;

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

      // Send OneSignal push notification to customer
      sendCustomerPushNotification(job.customerId, "WORK_COMPLETE", {
        jobId: job.id,
      }).catch((err) =>
        console.error("[Push] Failed to send work complete push notification:", err)
      );
    }

    // Send SMS when customer signs/confirms
    if (status === "SIGNED" && job.locksmith?.phone) {
      sendJobNotification("job_signed", smsContext).catch((err) =>
        console.error("[SMS] Failed to send job signed notification:", err)
      );

      // Send OneSignal push notification to locksmith
      if (job.locksmithId) {
        sendLocksmithPushNotification(job.locksmithId, "CUSTOMER_SIGNED", {
          jobId: job.id,
        }).catch((err) =>
          console.error("[Push] Failed to send customer signed push notification:", err)
        );
      }
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
