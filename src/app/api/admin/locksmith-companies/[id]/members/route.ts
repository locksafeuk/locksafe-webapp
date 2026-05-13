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

// GET /api/admin/locksmith-companies/[id]/members — list members
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const members = await prisma.locksmithCompanyMember.findMany({
      where: { companyId: id },
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
          },
        },
      },
      orderBy: { invitedAt: "asc" },
    });

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("GET /api/admin/locksmith-companies/[id]/members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/locksmith-companies/[id]/members — add a locksmith to the team
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: companyId } = await params;
    const body = await request.json();
    const { locksmithId, locksmithSplit, platformCommissionOverride, role } = body;

    if (!locksmithId) {
      return NextResponse.json({ error: "locksmithId is required" }, { status: 400 });
    }

    // Validate locksmithSplit range
    const split = locksmithSplit ?? 70;
    if (split < 0 || split > 100) {
      return NextResponse.json({ error: "locksmithSplit must be between 0 and 100" }, { status: 400 });
    }

    const locksmith = await prisma.locksmith.findUnique({ where: { id: locksmithId } });
    if (!locksmith) return NextResponse.json({ error: "Locksmith not found" }, { status: 404 });

    const company = await prisma.locksmithCompany.findUnique({ where: { id: companyId } });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    const membership = await prisma.locksmithCompanyMember.create({
      data: {
        companyId,
        locksmithId,
        locksmithSplit: split,
        platformCommissionOverride: platformCommissionOverride ?? null,
        role: role ?? "member",
        isActive: true,
        acceptedAt: new Date(),
      },
      include: {
        locksmith: { select: { id: true, name: true, email: true } },
      },
    });

    // Update locksmith teamRole if not already an owner
    if (locksmith.teamRole === "solo") {
      await prisma.locksmith.update({
        where: { id: locksmithId },
        data: { teamRole: role === "owner" ? "owner" : "member" },
      });
    }

    return NextResponse.json({ success: true, membership }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Locksmith is already a member of this team" }, { status: 409 });
    }
    console.error("POST /api/admin/locksmith-companies/[id]/members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
