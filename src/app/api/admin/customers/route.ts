import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

// GET: List all customers with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify the token is valid
    const { verifyToken } = await import("@/lib/auth");
    const payload = await verifyToken(authToken.value);

    if (!payload || payload.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const verified = searchParams.get("verified");
    const hasAccount = searchParams.get("hasAccount");
    const source = searchParams.get("source");
    const page = Number.parseInt(searchParams.get("page") || "1");
    const limit = Number.parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = {};

    // Search by name, email, or phone
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by email verification
    if (verified === "true") {
      where.emailVerified = true;
    } else if (verified === "false") {
      where.emailVerified = false;
    }

    // Filter by has password (account vs guest)
    if (hasAccount === "true") {
      where.passwordHash = { not: null };
    } else if (hasAccount === "false") {
      where.passwordHash = null;
    }

    // Filter by source
    if (source) {
      where.createdVia = source;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              jobs: true,
              reviews: true,
            },
          },
          jobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              jobNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    // Calculate aggregate stats
    const stats = await prisma.customer.aggregate({
      _count: { id: true },
    });

    const verifiedCount = await prisma.customer.count({
      where: { emailVerified: true },
    });

    const withAccountCount = await prisma.customer.count({
      where: { passwordHash: { not: null } },
    });

    const thisMonthCount = await prisma.customer.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    return NextResponse.json({
      success: true,
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        emailVerified: c.emailVerified,
        hasAccount: !!c.passwordHash,
        hasStripe: !!c.stripeCustomerId,
        createdVia: c.createdVia,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        jobCount: c._count.jobs,
        reviewCount: c._count.reviews,
        lastJob: c.jobs[0] || null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      stats: {
        total: stats._count.id,
        verified: verifiedCount,
        withAccount: withAccountCount,
        thisMonth: thisMonthCount,
      },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
