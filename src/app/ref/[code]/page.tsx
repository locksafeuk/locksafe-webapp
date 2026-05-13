import { redirect } from "next/navigation";
import prisma from "@/lib/db";

interface Props {
  params: Promise<{ code: string }>;
}

/**
 * /ref/[code]
 * Validates the referral code, increments click count, then redirects
 * to the registration page with ?ref=CODE pre-filled.
 */
export default async function ReferralLandingPage({ params }: Props) {
  const { code } = await params;
  const normalised = code.trim().toUpperCase();

  const referral = await prisma.referral.findUnique({
    where: { code: normalised },
    select: { status: true },
  });

  if (referral && referral.status === "active") {
    await prisma.referral.update({
      where: { code: normalised },
      data: { clickCount: { increment: 1 } },
    });
    redirect(`/register?ref=${normalised}`);
  }

  // Code not found or already used — just go to homepage
  redirect("/");
}
