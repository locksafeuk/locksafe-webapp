import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";


async function resolveCompanyId(request: NextRequest): Promise<string | null> {
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
    return searchParams.get("companyId");
  }

  if (decoded.type === "locksmith") {
    const company = await prisma.locksmithCompany.findFirst({
      where: { ownerId: decoded.id, isActive: true },
      select: { id: true },
    });
    return company?.id ?? null;
  }

  return null;
}

// PATCH /api/company/members/[memberId] — update a member's commission split
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const companyId = await resolveCompanyId(request);
    if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify membership belongs to this company
    const membership = await prisma.locksmithCompanyMember.findFirst({
      where: { id: memberId, companyId },
    });
    if (!membership) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const body = await request.json();
    const { locksmithSplit, platformCommissionOverride, role, isActive } = body;

    // Validate locksmithSplit
    if (locksmithSplit !== undefined) {
      if (typeof locksmithSplit !== "number" || locksmithSplit < 0 || locksmithSplit > 100) {
        return NextResponse.json({ error: "locksmithSplit must be 0–100" }, { status: 400 });
      }
    }

    const updated = await prisma.locksmithCompanyMember.update({
      where: { id: memberId },
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

    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    console.error("PATCH /api/company/members/[memberId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
