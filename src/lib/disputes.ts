/**
 * LockSafe Dispute / Chargeback System
 *
 * When Stripe fires a `charge.dispute.created` webhook:
 * 1. A Dispute record is created in the DB
 * 2. An evidence packet is automatically compiled (GPS, photos, signature, timeline)
 * 3. Admin is alerted via Telegram
 * 4. Admin can review and submit the evidence to Stripe from the dashboard
 */

import prisma from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { sendAdminAlert } from "@/lib/telegram";

export interface DisputeEvidence {
  jobNumber: string;
  customerName: string;
  locksmithName: string;
  amount: number;
  timeline: Array<{ event: string; at: string; gps?: string }>;
  photos: Array<{ type: string; url: string }>;
  hasSignature: boolean;
  signatureUrl?: string;
  reportUrl?: string;
  gpsTrail: Array<{ event: string; lat: number; lng: number }>;
}

/**
 * Build an evidence summary object from a job.
 * Used both for the evidence PDF and for direct Stripe submission.
 */
export async function buildDisputeEvidence(jobId: string): Promise<DisputeEvidence> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      locksmith: { select: { name: true, phone: true, email: true, licenseNumber: true } },
      photos: true,
      signature: true,
      report: true,
      quote: true,
    },
  });

  if (!job) throw new Error(`Job ${jobId} not found`);

  // Build timeline
  const timeline: DisputeEvidence["timeline"] = [];
  if (job.createdAt) timeline.push({ event: "Customer submitted job request", at: job.createdAt.toISOString() });
  if (job.acceptedAt) {
    const gps = job.acceptedGps as { lat?: number; lng?: number } | null;
    timeline.push({
      event: "Locksmith accepted job",
      at: job.acceptedAt.toISOString(),
      gps: gps?.lat ? `${gps.lat.toFixed(6)}, ${gps.lng?.toFixed(6)}` : undefined,
    });
  }
  if (job.enRouteAt) timeline.push({ event: "Locksmith marked en route", at: job.enRouteAt.toISOString() });
  if (job.arrivedAt) {
    const gps = job.arrivalGps as { lat?: number; lng?: number } | null;
    timeline.push({
      event: "Locksmith arrived at customer location",
      at: job.arrivedAt.toISOString(),
      gps: gps?.lat ? `${gps.lat.toFixed(6)}, ${gps.lng?.toFixed(6)}` : undefined,
    });
  }
  if (job.diagnosedAt) timeline.push({ event: "Diagnosis completed", at: job.diagnosedAt.toISOString() });
  if (job.workStartedAt) timeline.push({ event: "Work started", at: job.workStartedAt.toISOString() });
  if (job.workCompletedAt) timeline.push({ event: "Work completed", at: job.workCompletedAt.toISOString() });
  if (job.signedAt) {
    const gps = job.signatureGps as { lat?: number; lng?: number } | null;
    timeline.push({
      event: "Customer digitally signed off on completed work",
      at: job.signedAt.toISOString(),
      gps: gps?.lat ? `${gps.lat.toFixed(6)}, ${gps.lng?.toFixed(6)}` : undefined,
    });
  }

  // GPS trail
  const gpsTrail: DisputeEvidence["gpsTrail"] = [];
  const gpsFields = [
    { key: "requestGps", event: "Request" },
    { key: "acceptedGps", event: "Accept" },
    { key: "arrivalGps", event: "Arrival" },
    { key: "quoteGps", event: "Quote" },
    { key: "workStartedGps", event: "Work Start" },
    { key: "completionGps", event: "Completion" },
    { key: "signatureGps", event: "Signature" },
  ] as const;

  for (const { key, event } of gpsFields) {
    const gps = job[key] as { lat?: number; lng?: number } | null;
    if (gps?.lat && gps?.lng) {
      gpsTrail.push({ event, lat: gps.lat, lng: gps.lng });
    }
  }

  return {
    jobNumber: job.jobNumber,
    customerName: job.customer?.name ?? "Unknown",
    locksmithName: job.locksmith?.name ?? "Unknown",
    amount: job.quote?.total ?? job.assessmentFee,
    timeline,
    photos: job.photos.map((p) => ({ type: p.type, url: p.url })),
    hasSignature: !!job.signature,
    signatureUrl: job.signature?.signatureData ? `Signature on file — signed by ${job.signature.signerName}` : undefined,
    reportUrl: job.report?.pdfUrl,
    gpsTrail,
  };
}

/**
 * Format the evidence as a text summary for Stripe's `product_description` field.
 * Stripe accepts plain text and HTML in dispute evidence.
 */
export function formatEvidenceText(evidence: DisputeEvidence): string {
  const lines: string[] = [
    `LOCKSAFE UK — JOB EVIDENCE SUMMARY`,
    `Job Reference: ${evidence.jobNumber}`,
    `Customer: ${evidence.customerName}`,
    `Locksmith: ${evidence.locksmithName}`,
    `Total Amount: £${evidence.amount.toFixed(2)}`,
    ``,
    `=== SERVICE TIMELINE ===`,
  ];

  for (const event of evidence.timeline) {
    const dateStr = new Date(event.at).toLocaleString("en-GB", { timeZone: "Europe/London" });
    lines.push(`• ${dateStr} — ${event.event}${event.gps ? ` (GPS: ${event.gps})` : ""}`);
  }

  if (evidence.gpsTrail.length > 0) {
    lines.push(``, `=== GPS VERIFICATION (${evidence.gpsTrail.length} points) ===`);
    for (const g of evidence.gpsTrail) {
      lines.push(`• ${g.event}: ${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`);
    }
  }

  if (evidence.photos.length > 0) {
    lines.push(``, `=== PHOTO DOCUMENTATION (${evidence.photos.length} photos) ===`);
    for (const p of evidence.photos) {
      lines.push(`• ${p.type}: ${p.url}`);
    }
  }

  if (evidence.hasSignature) {
    lines.push(``, `=== DIGITAL SIGNATURE ===`);
    lines.push(`Customer digitally signed the completed work confirmation.`);
    if (evidence.signatureUrl) lines.push(evidence.signatureUrl);
  }

  if (evidence.reportUrl) {
    lines.push(``, `=== PDF JOB REPORT ===`);
    lines.push(`Full legal report: ${evidence.reportUrl}`);
  }

  lines.push(
    ``,
    `=== PLATFORM STATEMENT ===`,
    `This job was completed through LockSafe UK, a verified locksmith marketplace.`,
    `All job events are GPS-verified, timestamped, and stored on our platform.`,
    `The customer accepted the quote and confirmed completion by digital signature.`,
    `For any queries contact: support@locksafe.uk`
  );

  return lines.join("\n");
}

/**
 * Submit dispute evidence to Stripe.
 * Called from the admin dashboard "Submit to Stripe" button.
 */
export async function submitDisputeEvidenceToStripe(
  disputeId: string,
  adminName: string,
): Promise<void> {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new Error("Dispute not found");
  if (!dispute.jobId) throw new Error("Dispute has no linked job");

  const evidence = await buildDisputeEvidence(dispute.jobId);
  const evidenceText = formatEvidenceText(evidence);

  // Submit to Stripe
  await stripe.disputes.update(dispute.stripeDisputeId, {
    evidence: {
      product_description: evidenceText.slice(0, 10000), // Stripe max 10,000 chars
      customer_name: evidence.customerName,
      customer_signature: evidence.hasSignature ? "Customer digital signature on file" : undefined,
      receipt: evidence.reportUrl ?? undefined,
      service_documentation: evidence.reportUrl ?? undefined,
      uncategorized_text: evidenceText.slice(0, 10000),
    },
    submit: true,
  });

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      submittedAt: new Date(),
      submittedBy: adminName,
      status: "under_review",
    },
  });
}

/**
 * Handle `charge.dispute.created` Stripe webhook.
 * Creates the DB record and alerts admin.
 */
export async function handleDisputeCreated(stripeDispute: {
  id: string;
  charge: string;
  payment_intent?: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  evidence_details?: { due_by?: number };
}): Promise<void> {
  // Find the linked job via payment record
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripePaymentId: stripeDispute.charge },
        { stripePaymentIntentId: stripeDispute.payment_intent ?? "" },
      ],
    },
    include: {
      job: {
        include: {
          customer: { select: { id: true, name: true } },
          locksmith: { select: { id: true, name: true } },
          photos: { select: { id: true } },
          signature: { select: { id: true } },
          report: { select: { id: true } },
        },
      },
    },
  });

  const job = payment?.job;
  const dueBy = stripeDispute.evidence_details?.due_by
    ? new Date(stripeDispute.evidence_details.due_by * 1000)
    : null;

  const existing = await prisma.dispute.findUnique({
    where: { stripeDisputeId: stripeDispute.id },
  });

  if (!existing) {
    await prisma.dispute.create({
      data: {
        stripeDisputeId: stripeDispute.id,
        stripeChargeId: stripeDispute.charge,
        stripePaymentIntentId: stripeDispute.payment_intent,
        jobId: job?.id ?? "000000000000000000000000",
        customerId: job?.customer?.id,
        locksmithId: job?.locksmith?.id,
        amount: stripeDispute.amount / 100,
        currency: stripeDispute.currency,
        reason: stripeDispute.reason,
        status: stripeDispute.status,
        dueBy,
        hasGpsData: !!(job?.acceptedGps || job?.arrivalGps),
        hasPhotos: (job?.photos?.length ?? 0) > 0,
        hasSignature: !!job?.signature,
        hasReport: !!job?.report,
      },
    });
  } else {
    await prisma.dispute.update({
      where: { stripeDisputeId: stripeDispute.id },
      data: { status: stripeDispute.status, dueBy },
    });
  }

  // Alert admin via Telegram
  const evidenceScore = [
    job?.acceptedGps || job?.arrivalGps ? "GPS" : null,
    (job?.photos?.length ?? 0) > 0 ? `${job?.photos?.length} photos` : null,
    job?.signature ? "signature" : null,
    job?.report ? "PDF report" : null,
  ].filter(Boolean).join(", ");

  await sendAdminAlert({
    title: "STRIPE CHARGEBACK",
    severity: "error",
    message:
      `Amount: £${(stripeDispute.amount / 100).toFixed(2)}\n` +
      `Reason: ${stripeDispute.reason}\n` +
      `Job: ${job?.jobNumber ?? "unknown"}\n` +
      `Customer: ${job?.customer?.name ?? "unknown"}\n` +
      `Evidence: ${evidenceScore || "none"}\n` +
      `Due by: ${dueBy ? dueBy.toLocaleDateString("en-GB") : "unknown"}\n` +
      `Review: https://www.locksafe.uk/admin/disputes`,
  }).catch(console.error);
}

/**
 * Handle `charge.dispute.updated` — sync status changes from Stripe.
 */
export async function handleDisputeUpdated(stripeDispute: {
  id: string;
  status: string;
}): Promise<void> {
  await prisma.dispute.updateMany({
    where: { stripeDisputeId: stripeDispute.id },
    data: { status: stripeDispute.status },
  });
}

/**
 * Handle `charge.dispute.closed` — mark outcome.
 */
export async function handleDisputeClosed(stripeDispute: {
  id: string;
  status: string;
}): Promise<void> {
  const outcome = stripeDispute.status === "won" ? "won"
    : stripeDispute.status === "lost" ? "lost"
    : "withdrawn";

  await prisma.dispute.updateMany({
    where: { stripeDisputeId: stripeDispute.id },
    data: { status: stripeDispute.status, outcome, outcomeAt: new Date() },
  });

  if (outcome === "won") {
    await sendAdminAlert({ title: "DISPUTE WON", severity: "info", message: "Stripe ruled in our favour. No funds lost." }).catch(console.error);
  } else if (outcome === "lost") {
    await sendAdminAlert({ title: "DISPUTE LOST", severity: "error", message: "Funds returned to customer. Review case in /admin/disputes." }).catch(console.error);
  }
}
