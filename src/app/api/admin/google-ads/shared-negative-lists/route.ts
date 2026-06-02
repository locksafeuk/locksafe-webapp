/**
 * GET  /api/admin/google-ads/shared-negative-lists  — list all shared negative lists
 * POST /api/admin/google-ads/shared-negative-lists  — create or update a list
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;
  const lists = await prismaAny.googleAdsSharedNegativeList.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ lists });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, keywords } = body as {
    id?: string;
    name: string;
    keywords: string[];
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Array.isArray(keywords)) {
    return NextResponse.json({ error: "keywords must be an array" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaAny = prisma as any;

  if (id) {
    // Update existing
    const updated = await prismaAny.googleAdsSharedNegativeList.update({
      where: { id },
      data: {
        name: name.trim(),
        keywords: keywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean),
      },
    });
    return NextResponse.json({ list: updated });
  }

  // Create new
  const created = await prismaAny.googleAdsSharedNegativeList.create({
    data: {
      name: name.trim(),
      keywords: keywords.map((k: string) => k.toLowerCase().trim()).filter(Boolean),
    },
  });

  return NextResponse.json({ list: created }, { status: 201 });
}
