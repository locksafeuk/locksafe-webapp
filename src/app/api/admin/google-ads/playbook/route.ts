/**
 * GET  /api/admin/google-ads/playbook
 *      → returns the current self-learning campaign playbook (rules + markdown).
 *      Query: ?format=markdown returns text/markdown instead of JSON.
 *
 * POST /api/admin/google-ads/playbook
 *      Body: { action: "seed" | "export" }
 *      - "seed"   → (idempotent) writes the baseline template rules into the playbook.
 *      - "export" → writes the markdown mirror to disk and returns it.
 *      Defaults to "seed" when no action is given.
 *
 * Auth: admin session cookie OR cron bearer secret.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { verifyCronAuth } from "@/lib/cron-auth";
import {
  getPlaybookRules,
  renderPlaybookMarkdown,
  exportPlaybookToMarkdown,
  seedPlaybook,
} from "@/lib/google-ads-playbook";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload && payload.type === "admin");
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin()) && !verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get("format");
  if (format === "markdown") {
    const md = await renderPlaybookMarkdown();
    return new NextResponse(md, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  const rules = await getPlaybookRules();
  return NextResponse.json({
    count: rules.length,
    rules,
    markdown: await renderPlaybookMarkdown(),
  });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin()) && !verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action = "seed";
  try {
    const body = await request.json();
    if (body && typeof body.action === "string") action = body.action;
  } catch {
    // empty body → default action
  }

  if (action === "export") {
    const result = await exportPlaybookToMarkdown();
    return NextResponse.json({ success: true, action, ...result });
  }

  if (action === "seed") {
    const result = await seedPlaybook();
    return NextResponse.json({ success: true, action, ...result });
  }

  return NextResponse.json({ success: false, error: `Unknown action "${action}"` }, { status: 400 });
}
