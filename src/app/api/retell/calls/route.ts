export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminAuthenticated();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const category = searchParams.get("category");
    const outcome = searchParams.get("outcome");
    const status = searchParams.get("status");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const flagged = searchParams.get("flagged");

    const where: any = {};

    if (category) where.callCategory = category;
    if (outcome) where.outcome = outcome;
    if (status) where.callStatus = status;
    if (flagged === "true") where.flaggedForReview = true;

    if (dateFrom || dateTo) {
      where.startedAt = {};
      if (dateFrom) where.startedAt.gte = new Date(dateFrom);
      if (dateTo) where.startedAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { callerPhone: { contains: search, mode: "insensitive" } },
        { callerName: { contains: search, mode: "insensitive" } },
        { callerPostcode: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    const [calls, total] = await Promise.all([
      prisma.voiceCall.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.voiceCall.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      calls,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("[API] Error fetching calls:", error);
    return NextResponse.json({ error: "Failed to fetch calls" }, { status: 500 });
  }
}
