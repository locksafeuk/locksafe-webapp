import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { verifyToken, getServerSession } from "@/lib/auth";

/**
 * Self price-list endpoint for the locksmith's OWN price list.
 *
 * Auth accepts BOTH the mobile app's Bearer token (Authorization header) and
 * the web cookie session — the web profile endpoints are cookie-only, which the
 * mobile (Bearer) can't use, so this gives mobile a working authenticated path
 * while staying verifiable from the web cookie session too. Always scoped to the
 * token's own locksmith id (no id param) — a locksmith can only read/write their
 * own prices.
 */
async function getLocksmithSession(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const payload = await verifyToken(authHeader.slice(7));
    if (payload && payload.type === "locksmith") return payload;
  }
  const session = await getServerSession();
  if (session && session.type === "locksmith") return session;
  return null;
}

interface PriceItem {
  name: string;
  price: number;
}

function normalizeItems(input: unknown): PriceItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is { name?: unknown; price?: unknown } => !!p && typeof p === "object")
    .filter((p) => typeof p.name === "string" && (p.name as string).trim().length > 0)
    .map((p) => ({ name: String(p.name).trim(), price: Number(p.price) || 0 }));
}

export async function GET(request: NextRequest) {
  const session = await getLocksmithSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: session.id },
    select: { priceList: true },
  });
  return NextResponse.json({ success: true, priceList: locksmith?.priceList ?? null });
}

export async function PUT(request: NextRequest) {
  const session = await getLocksmithSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const priceList = {
    parts: normalizeItems(body?.priceList?.parts),
    labour: normalizeItems(body?.priceList?.labour),
  };
  await prisma.locksmith.update({
    where: { id: session.id },
    data: { priceList: priceList as unknown as Prisma.InputJsonValue },
  });
  return NextResponse.json({ success: true, priceList });
}
