import { NextResponse } from "next/server";
import { isLocksmithAuthenticated } from "@/lib/auth";
import { getLocksmithCompleteness } from "@/lib/locksmith-completeness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — completeness checklist for the authenticated locksmith. Powers the
// dashboard "Complete your setup" card so it lists EVERY blocking item
// (terms, base location, call-out fee, Stripe, photo, insurance), not just two.
export async function GET() {
  const session = await isLocksmithAuthenticated();
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const c = await getLocksmithCompleteness(session.id);
  if (!c) {
    return NextResponse.json({ success: false, error: "Locksmith not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    score: c.score,
    blockingDispatch: c.blockingDispatch,
    items: c.items.map((i) => ({ key: i.key, label: i.label, done: i.done, blocking: i.blocking })),
  });
}
