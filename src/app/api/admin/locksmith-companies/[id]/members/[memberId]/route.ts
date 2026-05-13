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

// PATCH /api/admin/locksmith-companies/[id]/members/[memberId] — update commission split
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: companyId, memberId } = await params;
    const body = await request.json();
    const { locksmithSplit, platformCommissionOverride, role, isActive } = body;

    if (locksmithSplit !== undefined && (locksmithSplit < 0 || locksmithSplit > 100)) {
      return NextResponse.json({ error: "locksmithSplit must be between 0 and 100" }, { status: 400 });
    }

    const membership = await prisma.locksmithCompanyMember.update({
      where: { id: memberId, companyId },
      data: {
        ...(locksmithSplit !== undefined && { locksmithSplit }),
        ...(platformCommissionOverride !== undefined && { platformCommissionOverride }),
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        locksmith: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, membership });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    console.error("PATCH .../members/[memberId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/locksmith-companies/[id]/members/[memberId] — remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: companyId, memberId } = await params;

    const membership = await prisma.locksmithCompanyMember.findUnique({
      where: { id: memberId, companyId },
    });
    if (!membership) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

    await prisma.locksmithCompanyMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    // If removed member was solo before, reset their teamRole
    const otherMemberships = await prisma.locksmithCompanyMember.count({
      where: { locksmithId: membership.locksmithId, isActive: true },
    });
    if (otherMemberships === 0) {
      await prisma.locksmith.update({
        where: { id: membership.locksmithId },
        data: { teamRole: "solo" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE .../members/[memberId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
