import { NextRequest, NextResponse } from "next/server";
import { calculateSurgeFee, describeSurge } from "@/lib/surge-pricing";

/**
 * GET /api/pricing/estimate?postcode=SW1A1AA
 *
 * Returns the current assessment fee for the given postcode.
 * Used by the booking form to show the customer the price before they commit.
 */
export async function GET(request: NextRequest) {
  const postcode = request.nextUrl.searchParams.get("postcode")?.trim();

  if (!postcode || postcode.length < 2) {
    return NextResponse.json({ error: "postcode is required" }, { status: 400 });
  }

  const surge = await calculateSurgeFee(postcode);
  const description = describeSurge(surge);

  return NextResponse.json({
    fee: surge.fee,
    baseFee: 29,
    isSurge: surge.isSurge,
    multiplier: surge.multiplier,
    reasons: surge.reasons,
    description,
  });
}
