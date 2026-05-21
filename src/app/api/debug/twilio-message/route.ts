import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/debug/twilio-message?sid=SMxxxxx
 * Auth: Bearer CRON_SECRET
 *
 * Fetches a Twilio message resource so we can see status, errorCode,
 * errorMessage, dateUpdated, etc. Used to debug why an accepted-but-undelivered
 * SMS never arrived at the carrier.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sid = request.nextUrl.searchParams.get("sid");
  if (!sid) {
    return NextResponse.json({ error: "sid query param required" }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return NextResponse.json({ error: "twilio_not_configured" }, { status: 500 });
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    },
  );
  const data = await res.json();
  return NextResponse.json({ ok: res.ok, status: res.status, data });
}
