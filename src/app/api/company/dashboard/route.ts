import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";


async function resolveCompany(request: NextRequest): Promise<{ companyId: string; role: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  let decoded: { id: string; type: string };
  try {
    decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as { id: string; type: string };
  } catch {
    return null;
  }

  if (decoded.type === "admin") {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) return null;
    return { companyId, role: "admin" };
  }

  if (decoded.type === "locksmith") {
    const company = await prisma.locksmithCompany.findFirst({
      where: { ownerId: decoded.id, isActive: true },
      select: { id: true },
    });
    if (company) return { companyId: company.id, role: "owner" };
    return null;
  }

  return null;
}

// GET /api/company/dashboard — full team dashboard data
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveCompany(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.locksmithCompany.findUnique({
      where: { id: ctx.companyId },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        memberships: {
          where: { isActive: true },
          include: {
            locksmith: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                totalJobs: true,
                totalEarnings: true,
                rating: true,
                performanceScore: true,
                isActive: true,
                isVerified: true,
              },
            },
          },
          orderBy: { invitedAt: "asc" },
        },
      },
    });

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    // Calculate team totals
    const totalJobs = company.memberships.reduce((sum, m) => sum + (m.locksmith.totalJobs ?? 0), 0);
    const totalEarnings = company.memberships.reduce((sum, m) => sum + (m.locksmith.totalEarnings ?? 0), 0);
    const avgRating =
      company.memberships.length > 0
        ? company.memberships.reduce((sum, m) => sum + (m.locksmith.rating ?? 0), 0) / company.memberships.length
        : 0;

    // Recent jobs for this team (all locksmith IDs in the team)
    const locksmithIds = company.memberships.map((m) => m.locksmithId);
    const recentJobs = await prisma.job.findMany({
      where: { locksmithId: { in: locksmithIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        problemType: true,
        propertyType: true,
        assessmentFee: true,
        createdAt: true,
        workCompletedAt: true,
        locksmithId: true,
        customer: { select: { name: true } },
        locksmith: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      company,
      stats: { totalJobs, totalEarnings, avgRating, memberCount: company.memberships.length },
      recentJobs,
    });
  } catch (error) {
    console.error("GET /api/company/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
