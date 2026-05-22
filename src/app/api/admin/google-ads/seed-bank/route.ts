/**
 * GET    /api/admin/google-ads/seed-bank   — list all keyword seeds
 * POST   /api/admin/google-ads/seed-bank   — add a new seed { keyword, category? }
 * PATCH  /api/admin/google-ads/seed-bank   — toggle isActive { id, isActive }
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { addSeed } from "@/agents/core/seed-bank";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const seeds = await prisma.keywordSeed.findMany({
    orderBy: [{ isActive: "desc" }, { score: "desc" }, { usageCount: "asc" }],
    take: 500,
  });
  return NextResponse.json({ seeds, total: seeds.length });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    keyword?: string;
    category?: string;
    notes?: string;
  };
  if (!body.keyword || typeof body.keyword !== "string") {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const ALLOWED_CATEGORIES = ["baseline", "learned", "competitor", "experimental"] as const;
  type Category = (typeof ALLOWED_CATEGORIES)[number];
  const category: Category = ALLOWED_CATEGORIES.includes(body.category as Category)
    ? (body.category as Category)
    : "experimental";

  const seed = await addSeed(body.keyword, {
    category,
    notes: body.notes,
    source: "admin:manual",
  });

  return NextResponse.json({ seed });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    isActive?: boolean;
  };
  if (!body.id || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "id + isActive required" }, { status: 400 });
  }

  const seed = await prisma.keywordSeed.update({
    where: { id: body.id },
    data: { isActive: body.isActive },
  });
  return NextResponse.json({ seed });
}
