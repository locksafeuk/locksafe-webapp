export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { exportMaskedRetellDataset } from "@/lib/retell-dataset";

function parseDate(input: string | null): Date | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function parseLimit(input: string | null): number | undefined {
  if (!input) return undefined;
  const parsed = Number.parseInt(input, 10);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));
    const limit = parseLimit(searchParams.get("limit"));
    const includeTestCalls = searchParams.get("includeTestCalls") === "true";

    const dataset = await exportMaskedRetellDataset({
      from,
      to,
      limit,
      includeTestCalls,
    });

    return NextResponse.json({ success: true, dataset });
  } catch (error: any) {
    console.error("[API] Error exporting Retell dataset:", error);
    return NextResponse.json({ error: "Failed to export dataset" }, { status: 500 });
  }
}