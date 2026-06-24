import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locksmithId, override } = await request.json();

  if (!locksmithId || typeof override !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.locksmith.update({
    where: { id: locksmithId },
    data: { commissionOverride: override },
  });

  return NextResponse.json({ success: true });
}
