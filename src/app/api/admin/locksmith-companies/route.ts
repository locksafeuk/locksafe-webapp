import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

async function requireAdmin(request: NextRequest) {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token");
  if (!authToken) return null;
  const { verifyToken } = await import("@/lib/auth");
  const payload = await verifyToken(authToken.value);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

// GET /api/admin/locksmith-companies — list all teams
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { contactEmail: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [companies, total] = await Promise.all([
      prisma.locksmithCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          memberships: {
            include: {
              locksmith: { select: { id: true, name: true, email: true, totalJobs: true, totalEarnings: true } },
            },
            where: { isActive: true },
          },
        },
      }),
      prisma.locksmithCompany.count({ where }),
    ]);

    return NextResponse.json({ success: true, companies, total, page, limit });
  } catch (error) {
    console.error("GET /api/admin/locksmith-companies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/locksmith-companies — create a new team
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, contactEmail, contactPhone, ownerId, registrationNumber, billingEmail, vatNumber, notes } = body;

    if (!name || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { error: "name, contactEmail and contactPhone are required" },
        { status: 400 }
      );
    }

    // Verify owner exists if provided
    if (ownerId) {
      // Validate MongoDB ObjectId format (24 hex chars)
      if (!/^[0-9a-fA-F]{24}$/.test(ownerId)) {
        return NextResponse.json({ error: "Invalid Manager Locksmith ID — please select a locksmith from the search" }, { status: 400 });
      }
      const owner = await prisma.locksmith.findUnique({ where: { id: ownerId } });
      if (!owner) return NextResponse.json({ error: "Owner locksmith not found" }, { status: 404 });
    }

    const company = await prisma.locksmithCompany.create({
      data: {
        name,
        contactEmail,
        contactPhone,
        ownerId: ownerId || null,
        registrationNumber: registrationNumber || null,
        billingEmail: billingEmail || null,
        vatNumber: vatNumber || null,
        notes: notes || null,
        // Auto-add owner as a member with role "owner" if provided
        ...(ownerId
          ? {
              memberships: {
                create: {
                  locksmithId: ownerId,
                  role: "owner",
                  locksmithSplit: 100, // Owner keeps 100% of their own jobs
                  acceptedAt: new Date(),
                },
              },
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        memberships: { include: { locksmith: { select: { id: true, name: true, email: true } } } },
      },
    });

    // Update the owner locksmith's teamRole
    if (ownerId) {
      await prisma.locksmith.update({
        where: { id: ownerId },
        data: { teamRole: "owner" },
      });
    }

    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A company with that email already exists" }, { status: 409 });
    }
    console.error("POST /api/admin/locksmith-companies error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
