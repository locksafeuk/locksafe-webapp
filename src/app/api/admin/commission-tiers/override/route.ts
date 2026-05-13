import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
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
