import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  sendQuoteReceivedEmail,
  sendQuoteAcceptedEmail,
  sendQuoteDeclinedEmail,
} from "@/lib/email";
import { notifyQuoteSubmitted, notifyQuoteAccepted, notifyQuoteDeclined } from "@/lib/telegram";
import { sendJobNotification, type JobSMSContext } from "@/lib/sms";
import {
  sendCustomerPushNotification,
  sendLocksmithPushNotification,
} from "@/lib/job-notifications";

// POST - Create a quote for a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      lockType,
      defect,
      difficulty,
      parts,
      labourCost,
      labourTime,
      partsTotal,
      subtotal,
      vat,
      total,
      quoteGps,
    } = body;

    // Validate required fields
    if (!lockType || !total) {
      return NextResponse.json(
        { success: false, error: "Lock type and total are required" },
        { status: 400 }
      );
    }

    // Get the job
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        locksmith: true,
        customer: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (!job.locksmithId) {
      return NextResponse.json(
        { success: false, error: "No locksmith assigned to this job" },
        { status: 400 }
      );
    }

    // Create or update the quote
    const quote = await prisma.quote.upsert({
      where: { jobId: id },
      update: {
        lockType,
        defect: defect || "",
        difficulty: difficulty || "medium",
        parts: parts || [],
        labourCost: labourCost || 0,
        labourTime: labourTime || 0,
        partsTotal: partsTotal || 0,
        subtotal: subtotal || total,
        vat: vat || 0,
        total,
        accepted: false,
        acceptedAt: null,
        declinedAt: null,
      },
      create: {
        jobId: id,
        locksmithId: job.locksmithId,
        lockType,
        defect: defect || "",
        difficulty: difficulty || "medium",
        parts: parts || [],
        labourCost: labourCost || 0,
        labourTime: labourTime || 0,
        partsTotal: partsTotal || 0,
        subtotal: subtotal || total,
        vat: vat || 0,
        total,
      },
    });

    // Update job status to QUOTED with GPS
    await prisma.job.update({
      where: { id },
      data: {
        status: "QUOTED",
        diagnosedAt: new Date(),
        quoteGps: quoteGps || null,
      },
    });

    // Send quote received email to customer (non-blocking)
    if (job.customer?.email && job.locksmith) {
      sendQuoteReceivedEmail(job.customer.email, {
        customerName: job.customer.name,
        jobId: job.id,
        jobNumber: job.jobNumber,
        locksmithName: job.locksmith.name,
        quoteTotal: total,
        estimatedTime: labourTime || 30,
        diagnosis: defect || lockType,
      }).catch((err) => console.error("[Email] Failed to send quote received email:", err));
    }

    // Send Telegram notification (non-blocking)
    if (job.locksmith && job.customer) {
      notifyQuoteSubmitted({
        jobNumber: job.jobNumber,
        jobId: job.id,
        locksmithName: job.locksmith.name,
        customerName: job.customer.name,
        labourCost: labourCost || 0,
        partsCost: partsTotal || 0,
        total,
        description: defect || lockType,
      }).catch((err) => console.error("[Telegram] Failed to send quote notification:", err));
    }

    // Send SMS notification to customer about full quote
    if (job.customer?.phone && job.locksmith) {
      const smsContext: JobSMSContext = {
        jobId: job.id,
        jobNumber: job.jobNumber,
        customerName: job.customer.name,
        customerPhone: job.customer.phone,
        locksmithName: job.locksmith.name,
        locksmithPhone: job.locksmith.phone || undefined,
        quotedAmount: total,
      };
      sendJobNotification("full_quote", smsContext).catch((err) =>
        console.error("[SMS] Failed to send quote notification:", err)
      );
    }

    // Send OneSignal push notification to customer
    if (job.customer) {
      sendCustomerPushNotification(job.customerId, "QUOTE_READY", {
        jobId: job.id,
        variables: { jobNumber: job.jobNumber },
      }).catch((err) =>
        console.error("[Push] Failed to send quote ready push notification:", err)
      );
    }

    return NextResponse.json({
      success: true,
      quote: {
        id: quote.id,
        total: quote.total,
        createdAt: quote.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating quote:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

// GET - Get quote for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const quote = await prisma.quote.findUnique({
      where: { jobId: id },
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json(
        { success: false, error: "Quote not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      quote,
    });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// PATCH - Accept or decline quote
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action } = await request.json();

    if (!action || !["accept", "decline"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    const quote = await prisma.quote.findUnique({
      where: { jobId: id },
    });

    if (!quote) {
      return NextResponse.json(
        { success: false, error: "Quote not found" },
        { status: 404 }
      );
    }

    // Get job with locksmith and customer for email
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        locksmith: true,
        customer: true,
      },
    });

    if (action === "accept") {
      await prisma.quote.update({
        where: { jobId: id },
        data: {
          accepted: true,
          acceptedAt: new Date(),
        },
      });

      await prisma.job.update({
        where: { id },
        data: {
          status: "QUOTE_ACCEPTED",
        },
      });

      // Send quote accepted email to locksmith (non-blocking)
      if (job?.locksmith?.email && job.customer) {
        sendQuoteAcceptedEmail(job.locksmith.email, {
          locksmithName: job.locksmith.name,
          jobNumber: job.jobNumber,
          customerName: job.customer.name,
          quoteTotal: quote.total,
          address: job.address,
          jobId: job.id,
        }).catch((err) => console.error("[Email] Failed to send quote accepted email:", err));
      }

      // Send Telegram notification (non-blocking)
      if (job?.locksmith && job?.customer) {
        notifyQuoteAccepted({
          jobNumber: job.jobNumber,
          jobId: job.id,
          locksmithName: job.locksmith.name,
          customerName: job.customer.name,
          total: quote.total,
        }).catch((err) => console.error("[Telegram] Failed to send quote accepted notification:", err));
      }

      // Send SMS notification to locksmith when quote is approved
      if (job?.locksmith?.phone && job?.customer) {
        const smsContext: JobSMSContext = {
          jobId: job.id,
          jobNumber: job.jobNumber,
          customerName: job.customer.name,
          customerPhone: job.customer.phone || "",
          locksmithName: job.locksmith.name,
          locksmithPhone: job.locksmith.phone,
          quotedAmount: quote.total,
        };
        sendJobNotification("quote_approved", smsContext).catch((err) =>
          console.error("[SMS] Failed to send quote approved notification:", err)
        );
      }

      // Send OneSignal push notification to locksmith
      if (job?.locksmithId) {
        sendLocksmithPushNotification(job.locksmithId, "QUOTE_ACCEPTED", {
          jobId: job.id,
          variables: { jobNumber: job.jobNumber },
        }).catch((err) =>
          console.error("[Push] Failed to send quote accepted push notification:", err)
        );
      }
    } else {
      await prisma.quote.update({
        where: { jobId: id },
        data: {
          accepted: false,
          declinedAt: new Date(),
        },
      });

      await prisma.job.update({
        where: { id },
        data: {
          status: "QUOTE_DECLINED",
        },
      });

      // Send quote declined email to locksmith (non-blocking)
      if (job?.locksmith?.email && job.customer) {
        sendQuoteDeclinedEmail(job.locksmith.email, {
          locksmithName: job.locksmith.name,
          jobNumber: job.jobNumber,
          customerName: job.customer.name,
          quoteTotal: quote.total,
          address: job.address,
        }).catch((err) => console.error("[Email] Failed to send quote declined email:", err));
      }

      // Send Telegram notification (non-blocking)
      if (job?.locksmith && job?.customer) {
        notifyQuoteDeclined({
          jobNumber: job.jobNumber,
          jobId: job.id,
          locksmithName: job.locksmith.name,
          customerName: job.customer.name,
          total: quote.total,
        }).catch((err) => console.error("[Telegram] Failed to send quote declined notification:", err));
      }

      // Send OneSignal push notification to locksmith
      if (job?.locksmithId) {
        sendLocksmithPushNotification(job.locksmithId, "QUOTE_DECLINED", {
          jobId: job.id,
          variables: { jobNumber: job.jobNumber },
        }).catch((err) =>
          console.error("[Push] Failed to send quote declined push notification:", err)
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: action === "accept" ? "Quote accepted" : "Quote declined",
    });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update quote" },
      { status: 500 }
    );
  }
}
