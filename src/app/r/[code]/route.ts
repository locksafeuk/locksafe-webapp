/**
 * Branded short-link redirect — GET /r/{code}
 * 302 to the target URL (clicks are logged); unknown codes go to the homepage.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveShortLink } from "@/lib/short-link";

export const dynamic = "force-dynamic";

const FALLBACK_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://locksafe.uk";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const target = code ? await resolveShortLink(code) : null;
  return NextResponse.redirect(target || FALLBACK_URL, 302);
}
