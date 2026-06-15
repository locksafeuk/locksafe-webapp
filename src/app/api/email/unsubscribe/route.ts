import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken, suppressEmail, isEmailSuppressed } from "@/lib/email-unsubscribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parse(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return { email: (searchParams.get("e") || "").trim(), token: (searchParams.get("t") || "").trim() };
}

// GET — validate the link WITHOUT mutating (email scanners pre-fetch links, so
// a GET must never unsubscribe). Returns whether the token is valid + status.
export async function GET(req: NextRequest) {
  const { email, token } = parse(req);
  if (!verifyEmailToken(email, token)) {
    return NextResponse.json({ ok: false, valid: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true, valid: true, email, suppressed: await isEmailSuppressed(email) });
}

// POST — actually unsubscribe. Used by the page's confirm button AND by mail
// clients doing RFC 8058 one-click (List-Unsubscribe-Post). Idempotent.
export async function POST(req: NextRequest) {
  const { email, token } = parse(req);
  if (!verifyEmailToken(email, token)) {
    return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 400 });
  }
  await suppressEmail(email, { reason: "unsubscribe", source: "one_click" });
  return NextResponse.json({ ok: true, email, unsubscribed: true });
}
