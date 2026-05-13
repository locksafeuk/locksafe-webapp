import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin-secret";

function verifyAdminAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const token = auth?.replace("Bearer ", "");
  return token === ADMIN_SECRET;
}

type Params = { params: { id: string } };

/**
 * GET /api/admin/organisations/[id]
 * Returns full org detail with members, properties, and recent jobs.
 *
 * PATCH /api/admin/organisations/[id]
 * Updates org fields.
 */

export async function GET(request: NextRequest, { params }: Params) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organisation.findUnique({
    where: { id: params.id },
    include: {
      members: {
        include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
      },
      properties: true,
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          jobNumber: true,
          status: true,
          problemType: true,
          postcode: true,
          assessmentFee: true,
          createdAt: true,
        },
      },
    },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ organisation: org });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowed = ["name", "type", "contactName", "contactEmail", "contactPhone",
    "contractedRate", "paymentTerms", "vatNumber", "billingEmail", "creditBalance", "isActive", "notes"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const org = await prisma.organisation.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ organisation: org });
}
