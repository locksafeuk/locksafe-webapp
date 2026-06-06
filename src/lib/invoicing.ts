import prisma from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { JobStatus } from "@prisma/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";
const VAT_RATE = 0.20; // 20% UK VAT

// Counter stored in DB is unavailable here, so we use a timestamp-based number
function buildInvoiceNumber(orgId: string, period: string): string {
  const suffix = orgId.slice(-4).toUpperCase();
  return `INV-${period}-${suffix}`;
}

/**
 * Generate invoices for all active organisations for a given billing period.
 * Default: previous calendar month.
 */
export async function generateMonthlyInvoices(
  targetPeriod?: string // "YYYY-MM" — defaults to last month
): Promise<{
  generated: number;
  skipped: number;
  errors: number;
  invoiceIds: string[];
}> {
  const now = new Date();
  const periodDate = targetPeriod
    ? new Date(`${targetPeriod}-01T00:00:00Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const period = `${periodDate.getUTCFullYear()}-${String(periodDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const periodStart = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() + 1, 0, 23, 59, 59));

  const orgs = await prisma.organisation.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
      billingEmail: true,
      vatNumber: true,
      paymentTerms: true,
      contractedRate: true,
      invoices: {
        where: { period },
        select: { id: true },
      },
    },
  });

  let generated = 0;
  let skipped = 0;
  let errors = 0;
  const invoiceIds: string[] = [];

  for (const org of orgs) {
    // Skip if invoice already exists for this period
    if (org.invoices.length > 0) {
      skipped++;
      continue;
    }

    // Find SIGNED jobs in period for this org
    const jobs = await prisma.job.findMany({
      where: {
        organisationId: org.id,
        status: JobStatus.SIGNED,
        signedAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        id: true,
        jobNumber: true,
        postcode: true,
        problemType: true,
        assessmentFee: true,
        signedAt: true,
        property: { select: { address: true, reference: true } },
        customer: { select: { name: true } },
        quote: { select: { total: true } },
      },
    });

    if (jobs.length === 0) {
      skipped++;
      continue;
    }

    const subtotal = jobs.reduce((sum, j) => {
      const jobTotal = (j.assessmentFee ?? 0) + (j.quote?.total ?? 0);
      return sum + jobTotal;
    }, 0);
    const vatAmount = subtotal * VAT_RATE;
    const total = subtotal + vatAmount;

    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + (org.paymentTerms ?? 30));

    const invoiceNumber = buildInvoiceNumber(org.id, period);

    try {
      const invoice = await prisma.orgInvoice.create({
        data: {
          orgId: org.id,
          invoiceNumber,
          period,
          periodStart,
          periodEnd,
          jobIds: jobs.map((j) => j.id),
          jobCount: jobs.length,
          subtotal: Math.round(subtotal * 100) / 100,
          vatAmount: Math.round(vatAmount * 100) / 100,
          total: Math.round(total * 100) / 100,
          dueDate,
          status: "sent",
        },
      });

      invoiceIds.push(invoice.id);

      // Send invoice email
      const recipientEmail = org.billingEmail || org.contactEmail;
      await sendInvoiceEmail({
        to: recipientEmail,
        orgName: org.name,
        contactName: org.contactName,
        invoiceNumber,
        period,
        periodStart,
        periodEnd,
        dueDate,
        jobs,
        subtotal,
        vatAmount,
        total,
        vatNumber: org.vatNumber,
        invoiceId: invoice.id,
      });

      generated++;
    } catch (e) {
      console.error(`[Invoicing] Failed to create invoice for org ${org.id}:`, e);
      errors++;
    }
  }

  return { generated, skipped, errors, invoiceIds };
}

/**
 * Send the HTML invoice email to the organisation.
 */
async function sendInvoiceEmail(data: {
  to: string;
  orgName: string;
  contactName: string;
  invoiceNumber: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  jobs: Array<{
    jobNumber: string;
    postcode: string;
    problemType: string;
    assessmentFee: number | null; // Job.assessmentFee is nullable; body coalesces with ?? 0
    signedAt: Date | null;
    property: { address: string; reference: string | null } | null;
    customer: { name: string };
    quote: { total: number } | null;
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  vatNumber: string | null | undefined;
  invoiceId: string;
}) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  const fmtGBP = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const problemLabels: Record<string, string> = {
    lockout: "Lockout",
    broken: "Broken Lock",
    "key-stuck": "Key Stuck",
    "lost-keys": "Lost Keys",
    burglary: "Burglary Repair",
    other: "Other",
  };

  const jobRows = data.jobs
    .map((j) => {
      const jobTotal = (j.assessmentFee ?? 0) + (j.quote?.total ?? 0);
      const ref = j.property?.reference ? ` (${j.property.reference})` : "";
      return `
      <tr>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${j.jobNumber}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${j.signedAt ? fmt(j.signedAt) : "—"}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${j.postcode}${ref}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:13px;">${problemLabels[j.problemType] ?? j.problemType}</td>
        <td style="padding:8px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:right;">${fmtGBP(jobTotal)}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: system-ui, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 680px; margin: 0 auto; }
        .header { background: #1e293b; color: white; padding: 28px 32px; border-radius: 12px 12px 0 0; }
        .body { background: white; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
        .total-row td { font-weight: 700; padding: 10px 8px; }
        .meta { display: flex; gap: 32px; margin-bottom: 24px; }
        .meta-block { flex: 1; }
        .meta-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
        .meta-value { font-size: 14px; font-weight: 600; }
        .badge { display: inline-block; background: #fef9c3; color: #854d0e; padding: 4px 12px; border-radius: 100px; font-size: 13px; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:22px; font-weight:700;">🔑 LockSafe UK</div>
              <div style="opacity:0.7; font-size:13px; margin-top:4px;">VAT No. GB 123 4567 89</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:18px; font-weight:700;">TAX INVOICE</div>
              <div style="opacity:0.7; font-size:13px;">${data.invoiceNumber}</div>
            </div>
          </div>
        </div>
        <div class="body">

          <!-- Meta -->
          <div class="meta">
            <div class="meta-block">
              <div class="meta-label">Bill To</div>
              <div class="meta-value">${data.orgName}</div>
              <div style="font-size:13px; color:#64748b;">${data.contactName}</div>
              ${data.vatNumber ? `<div style="font-size:13px; color:#64748b;">VAT: ${data.vatNumber}</div>` : ""}
            </div>
            <div class="meta-block">
              <div class="meta-label">Billing Period</div>
              <div class="meta-value">${fmt(data.periodStart)} – ${fmt(data.periodEnd)}</div>
            </div>
            <div class="meta-block">
              <div class="meta-label">Due Date</div>
              <div class="meta-value">${fmt(data.dueDate)}</div>
              <span class="badge">Payment Due</span>
            </div>
          </div>

          <!-- Job Table -->
          <table>
            <thead>
              <tr>
                <th>Job No.</th>
                <th>Date</th>
                <th>Location</th>
                <th>Service</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${jobRows}
            </tbody>
            <tfoot>
              <tr><td colspan="5" style="padding:8px;"></td></tr>
              <tr>
                <td colspan="4" style="padding:8px 8px 4px; text-align:right; font-size:13px; color:#64748b;">Subtotal</td>
                <td style="padding:8px 8px 4px; text-align:right; font-size:13px;">${fmtGBP(data.subtotal)}</td>
              </tr>
              <tr>
                <td colspan="4" style="padding:4px 8px; text-align:right; font-size:13px; color:#64748b;">VAT (20%)</td>
                <td style="padding:4px 8px; text-align:right; font-size:13px;">${fmtGBP(data.vatAmount)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="4" style="padding:12px 8px; text-align:right; font-size:15px; border-top:2px solid #1e293b;">Total Due</td>
                <td style="padding:12px 8px; text-align:right; font-size:15px; border-top:2px solid #1e293b;">${fmtGBP(data.total)}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Payment Instructions -->
          <div style="margin-top:32px; background:#f1f5f9; border-radius:8px; padding:16px; font-size:13px; color:#475569;">
            <strong>Payment</strong><br>
            Please pay by bank transfer to:<br>
            Account Name: <strong>LockSafe UK Ltd</strong><br>
            Sort Code: <strong>20-00-00</strong> · Account: <strong>12345678</strong><br>
            Reference: <strong>${data.invoiceNumber}</strong>
          </div>

          <p style="font-size:12px; color:#94a3b8; margin-top:24px;">
            View invoice online: <a href="${SITE_URL}/admin/organisations/invoices/${data.invoiceId}" style="color:#6366f1;">${SITE_URL}/admin/organisations/invoices/${data.invoiceId}</a><br>
            Questions? Email <a href="mailto:billing@locksafe.uk" style="color:#6366f1;">billing@locksafe.uk</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const { sendEmail: emailSend } = await import("@/lib/email");
  await emailSend({
    to: data.to,
    subject: `Invoice ${data.invoiceNumber} — LockSafe UK (${data.period})`,
    html,
  });
}
