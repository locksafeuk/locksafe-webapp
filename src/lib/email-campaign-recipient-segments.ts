import prisma from "@/lib/db";

export type LocksmithCampaignSegment =
  | "all_locksmiths"
  | "active_locksmiths"
  | "inactive_locksmiths"
  | "stripe_not_onboarded"
  | "schedule_enabled"
  | "no_base_location";

export interface LocksmithRecipient {
  id: string;
  name: string;
  email: string;
}

function getSegmentWhere(segment: LocksmithCampaignSegment): Record<string, unknown> {
  const base: Record<string, unknown> = {
    emailNotifications: true,
  };

  switch (segment) {
    case "active_locksmiths":
      return { ...base, isActive: true };
    case "inactive_locksmiths":
      return { ...base, isActive: false };
    case "stripe_not_onboarded":
      return { ...base, stripeConnectOnboarded: false };
    case "schedule_enabled":
      return { ...base, scheduleEnabled: true };
    case "no_base_location":
      return {
        ...base,
        OR: [{ baseLat: null }, { baseLng: null }],
      };
    case "all_locksmiths":
    default:
      return base;
  }
}

export async function getLocksmithRecipientsBySegment(
  segment: LocksmithCampaignSegment,
  maxRecipients?: number,
): Promise<LocksmithRecipient[]> {
  const where = getSegmentWhere(segment);

  const locksmiths = await prisma.locksmith.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(maxRecipients ? { take: maxRecipients } : {}),
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return locksmiths
    .filter((locksmith) => Boolean(locksmith.email))
    .map((locksmith) => ({
      id: locksmith.id,
      name: locksmith.name,
      email: locksmith.email,
    }));
}

export async function getLocksmithSegmentCounts(): Promise<Record<LocksmithCampaignSegment, number>> {
  const segments: LocksmithCampaignSegment[] = [
    "all_locksmiths",
    "active_locksmiths",
    "inactive_locksmiths",
    "stripe_not_onboarded",
    "schedule_enabled",
    "no_base_location",
  ];

  const entries = await Promise.all(
    segments.map(async (segment) => {
      const count = await prisma.locksmith.count({ where: getSegmentWhere(segment) });
      return [segment, count] as const;
    }),
  );

  return Object.fromEntries(entries) as Record<LocksmithCampaignSegment, number>;
}
