import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { generateMonthlyInvoices } from "@/lib/invoicing";


/**
 * GET /api/cron/generate-invoices
 *
 * Runs on the 2nd of each month at 06:00 UTC (after all end-of-month jobs are settled).
 * Generates invoices for all active organisations for the previous calendar month.
 *
 * Can also be triggered manually with an optional ?period=YYYY-MM query param.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? undefined; // e.g. "2025-01"

  try {
    const result = await generateMonthlyInvoices(period);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[InvoiceCron] Failed:", error);
    return NextResponse.json(
      { success: false, error: "Invoice generation failed" },
      { status: 500 }
    );
  }
}
