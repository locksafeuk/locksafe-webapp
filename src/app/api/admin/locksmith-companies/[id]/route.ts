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

// GET /api/admin/locksmith-companies/[id] — single team with full member detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const company = await prisma.locksmithCompany.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        memberships: {
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
                commissionRate: true,
              },
            },
          },
          orderBy: { invitedAt: "asc" },
        },
      },
    });

    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

    return NextResponse.json({ success: true, company });
  } catch (error) {
    console.error("GET /api/admin/locksmith-companies/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/locksmith-companies/[id] — update company details
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      contactEmail,
      contactPhone,
      ownerId,
      registrationNumber,
      billingEmail,
      vatNumber,
      notes,
      isActive,
      stripeConnectId,
      stripeConnectOnboarded,
      stripeConnectVerified,
    } = body;

    const company = await prisma.locksmithCompany.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(ownerId !== undefined && { ownerId }),
        ...(registrationNumber !== undefined && { registrationNumber }),
        ...(billingEmail !== undefined && { billingEmail }),
        ...(vatNumber !== undefined && { vatNumber }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
        ...(stripeConnectId !== undefined && { stripeConnectId }),
        ...(stripeConnectOnboarded !== undefined && { stripeConnectOnboarded }),
        ...(stripeConnectVerified !== undefined && { stripeConnectVerified }),
      },
    });

    return NextResponse.json({ success: true, company });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.error("PATCH /api/admin/locksmith-companies/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/locksmith-companies/[id] — deactivate (soft delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.locksmithCompany.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.error("DELETE /api/admin/locksmith-companies/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
