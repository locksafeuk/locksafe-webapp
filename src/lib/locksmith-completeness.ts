/**
 * Locksmith Profile Completeness Engine
 *
 * Single source of truth for "what is missing on this locksmith's profile".
 * Consumers: WhatsApp/Telegram bot "profile" command, dashboard SetupChecklist,
 * onboarding nudges (Build B), admin views (Build B).
 */

import prisma from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.locksafe.uk";

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  /** True if missing this item prevents receiving/being paid for jobs */
  blocking: boolean;
  deepLink: string;
}

export interface CompletenessResult {
  score: number; // 0-100
  items: CompletenessItem[];
  missing: CompletenessItem[];
  blockingDispatch: boolean;
}

type LocksmithCompletenessFields = {
  termsAcceptedAt: Date | null;
  baseAddress: string | null;
  baseLat: number | null;
  baseLng: number | null;
  defaultAssessmentFee: number | null;
  stripeConnectOnboarded: boolean;
  stripeConnectVerified: boolean;
  profileImage: string | null;
  profilePhotoVerified: boolean;
  insuranceDocumentUrl: string | null;
  insuranceStatus: string;
  dbsStatus: string;
  certificationDocumentUrl: string | null;
  nativeDeviceToken: string | null;
  webPushSubscription: string | null;
};

export const COMPLETENESS_SELECT = {
  termsAcceptedAt: true,
  baseAddress: true,
  baseLat: true,
  baseLng: true,
  defaultAssessmentFee: true,
  stripeConnectOnboarded: true,
  stripeConnectVerified: true,
  profileImage: true,
  profilePhotoVerified: true,
  insuranceDocumentUrl: true,
  insuranceStatus: true,
  dbsStatus: true,
  certificationDocumentUrl: true,
  nativeDeviceToken: true,
  webPushSubscription: true,
} as const;

const UK_POSTCODE_RE = /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i;

export function computeCompleteness(l: LocksmithCompletenessFields): CompletenessResult {
  const settings = `${SITE_URL}/locksmith/settings`;

  const items: CompletenessItem[] = [
    {
      key: "terms",
      label: "Accept terms & conditions",
      done: Boolean(l.termsAcceptedAt),
      blocking: true,
      deepLink: settings,
    },
    {
      key: "base_location",
      label: "Set your base location (postcode)",
      done: Boolean(
        l.baseLat != null && l.baseLng != null && l.baseAddress && UK_POSTCODE_RE.test(l.baseAddress),
      ),
      blocking: true,
      deepLink: settings,
    },
    {
      key: "callout_fee",
      label: "Set your call-out fee",
      done: l.defaultAssessmentFee != null && l.defaultAssessmentFee > 0,
      blocking: true,
      deepLink: settings,
    },
    {
      key: "stripe",
      label: "Connect payouts (Stripe)",
      done: l.stripeConnectOnboarded && l.stripeConnectVerified,
      blocking: true,
      deepLink: `${SITE_URL}/locksmith/earnings`,
    },
    {
      key: "photo",
      label: "Upload a verified profile photo",
      done: Boolean(l.profileImage) && l.profilePhotoVerified,
      blocking: false,
      deepLink: settings,
    },
    {
      key: "insurance",
      label: "Upload valid insurance",
      done: Boolean(l.insuranceDocumentUrl) && ["verified", "pending_review"].includes(l.insuranceStatus),
      blocking: false,
      deepLink: settings,
    },
    {
      key: "dbs",
      label: "Upload your DBS check",
      done: Boolean(l.certificationDocumentUrl) && ["verified", "pending_review"].includes(l.dbsStatus),
      blocking: false,
      deepLink: settings,
    },
    {
      key: "app_install",
      label: "Install the LockSafe app (job alerts)",
      done: Boolean(l.nativeDeviceToken || l.webPushSubscription),
      blocking: false,
      deepLink: `${SITE_URL}/install`,
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const missing = items.filter((i) => !i.done);

  return {
    score: Math.round((doneCount / items.length) * 100),
    items,
    missing,
    blockingDispatch: missing.some((i) => i.blocking),
  };
}

export async function getLocksmithCompleteness(locksmithId: string): Promise<CompletenessResult | null> {
  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: COMPLETENESS_SELECT,
  });
  if (!locksmith) return null;
  return computeCompleteness(locksmith as LocksmithCompletenessFields);
}

/**
 * Hard gate for switching to "Available". A locksmith with no base postcode is
 * invisible to job dispatch (the matcher requires baseLat), so letting them
 * appear Available is misleading — it produces unassigned jobs in their own
 * area (KAMIL's exact trap). Returns a block object if they can't go available
 * yet, or null if they're clear. Shared by the availability API + the bot.
 */
export async function getAvailabilityBlock(
  locksmithId: string,
): Promise<{ message: string; deepLink: string; alsoMissing: string[] } | null> {
  const c = await getLocksmithCompleteness(locksmithId);
  if (!c) return null;
  const base = c.missing.find((m) => m.key === "base_location");
  if (!base) return null;
  const alsoMissing = c.missing
    .filter((m) => m.blocking && m.key !== "base_location")
    .map((m) => m.label);
  return {
    message:
      "Set your base postcode before going Available — without it we can't match you to nearby jobs.",
    deepLink: base.deepLink,
    alsoMissing,
  };
}
