import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  sendQuoteReceivedEmail,
  sendQuoteAcceptedEmail,
  sendQuoteDeclinedEmail,
} from "@/lib/email";
import { notifyQuoteSubmitted, notifyQuoteAccepted, notifyQuoteDeclined } from "@/lib/telegram";
import { sendJobNotification, type JobSMSContext } from "@/lib/sms";

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
      gps, // mobile app sends `gps`; web sends `quoteGps`
    } = body;

    // Normalize parts to the QuotePart composite shape (name, quantity,
    // unitPrice, total). `total` is REQUIRED by the schema — if a caller omits
    // it the whole quote create throws a 500. Default it to unitPrice*quantity
    // so a missing per-part total can never break quote submission.
    const normalizedParts = (Array.isArray(parts) ? parts : []).map(
      (p: { name?: unknown; quantity?: unknown; unitPrice?: unknown; total?: unknown }) => {
        const quantity = Number(p?.quantity ?? 1) || 1;
        const unitPrice = Number(p?.unitPrice ?? 0) || 0;
        const lineTotal = Number(p?.total ?? unitPrice * quantity) || unitPrice * quantity;
        return { name: String(p?.name ?? ""), quantity, unitPrice, total: lineTotal };
      },
    );

    // ── Totals: compute server-side when the client doesn't send them. ──────
    // The mobile app calculates totals locally but only POSTs lockType/defect/
    // difficulty/parts/labourCost/labourTime/gps — NOT partsTotal/subtotal/vat/
    // total. The old code did `if (!total) → 400`, so every mobile quote failed
    // with "Lock type and total are required" (HTTP 400) and jobs could never be
    // completed. We now derive any missing money field from labour + parts so
    // the already-deployed app works without an App Store / Play release.
    const labour = Number(labourCost) || 0;
    const computedPartsTotal = normalizedParts.reduce((s, p) => s + p.total, 0);
    const partsTotalFinal = Number(partsTotal ?? computedPartsTotal) || computedPartsTotal;
    const subtotalProvided = subtotal != null ? Number(subtotal) : null;
    const subtotalFinal =
      subtotalProvided != null && !Number.isNaN(subtotalProvided)
        ? subtotalProvided
        : labour + partsTotalFinal;
    const vatFinal = vat != null && !Number.isNaN(Number(vat)) ? Number(vat) : subtotalFinal * 0.2;
    const totalProvided = total != null ? Number(total) : null;
    const totalFinal =
      totalProvided != null && !Number.isNaN(totalProvided) && totalProvided > 0
        ? totalProvided
        : subtotalFinal + vatFinal;

    // Validate: lockType required, and the quote must have a positive value
    // (either labour or parts). This replaces the old `!total` check that
    // rejected every mobile submission.
    if (!lockType) {
      return NextResponse.json(
        { success: false, error: "Lock type is required" },
        { status: 400 }
      );
    }
    if (!(totalFinal > 0)) {
      return NextResponse.json(
        { success: false, error: "Add a labour cost or at least one part — the quote total is £0." },
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

    // Don't drag a finished job backwards to QUOTED. Submitting a quote forces
    // status:"QUOTED" below, so block it once the job is terminal.
    if (["COMPLETED", "SIGNED", "CANCELLED"].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot quote a job in status ${job.status}.` },
        { status: 409 }
      );
    }

    // Create or update the quote
    const quote = await prisma.quote.upsert({
      where: { jobId: id },
      update: {
        lockType,
        defect: defect || "",
        difficulty: difficulty || "medium",
        parts: normalizedParts,
        labourCost: labour,
        labourTime: labourTime || 0,
        partsTotal: partsTotalFinal,
        subtotal: subtotalFinal,
        vat: vatFinal,
        total: totalFinal,
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
        parts: normalizedParts,
        labourCost: labour,
        labourTime: labourTime || 0,
        partsTotal: partsTotalFinal,
        subtotal: subtotalFinal,
        vat: vatFinal,
        total: totalFinal,
      },
    });

    // Update job status to QUOTED with GPS
    await prisma.job.update({
      where: { id },
      data: {
        status: "QUOTED",
        diagnosedAt: new Date(),
        quoteGps: quoteGps || gps || null,
      },
    });

    // Send quote received email to customer (non-blocking)
    if (job.customer?.email && job.locksmith) {
      sendQuoteReceivedEmail(job.customer.email, {
        customerName: job.customer.name,
        jobId: job.id,
        jobNumber: job.jobNumber,
        locksmithName: job.locksmith.name,
        quoteTotal: totalFinal,
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
        labourCost: labour,
        partsCost: partsTotalFinal,
        total: totalFinal,
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
        quotedAmount: totalFinal,
      };
      sendJobNotification("full_quote", smsContext).catch((err) =>
        console.error("[SMS] Failed to send quote notification:", err)
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
