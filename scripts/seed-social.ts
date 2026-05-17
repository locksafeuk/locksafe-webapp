/**
 * Seed Script: Social Media Config
 *
 * Seeds:
 *  - ContentPillar records (5 pillars for daily rotation)
 *  - AutopilotConfig (1 record, enabled)
 *  - SocialAccount stubs for platforms (tokens from env)
 *
 * Run: npx ts-node -P tsconfig.scripts.json scripts/seed-social.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding social media config...\n");

  // ── 1. Content Pillars ───────────────────────────────────────────
  const pillars = [
    {
      name: "security-tips",
      displayName: "Security Tips",
      description: "Practical home & business security advice that positions LockSafe as the expert",
      color: "#2563EB",
      icon: "Shield",
      toneGuidelines: ["authoritative", "educational", "helpful"],
      topicExamples: [
        "5 signs your locks are outdated",
        "How burglars choose their targets",
        "UPVC vs mortice — which is safer?",
      ],
      hashtags: ["#HomeSecurityTips", "#LockSafety", "#SecurityAdvice", "#UKHomeSecurity"],
      postsPerWeek: 2,
      preferredDays: ["monday", "thursday"],
      preferredTimes: ["09:00", "18:00"],
    },
    {
      name: "success-stories",
      displayName: "Success Stories",
      description: "Real customer wins — lockouts solved fast, emergencies handled, lives changed",
      color: "#16A34A",
      icon: "Star",
      toneGuidelines: ["warm", "celebratory", "reassuring"],
      topicExamples: [
        "Midnight lockout resolved in 12 minutes",
        "Locksmith saved elderly customer in the rain",
        "Business rekeyed overnight before opening",
      ],
      hashtags: ["#CustomerStory", "#LocksmithHero", "#LockSafe", "#TrueStory"],
      postsPerWeek: 2,
      preferredDays: ["tuesday", "friday"],
      preferredTimes: ["12:00", "18:30"],
    },
    {
      name: "trust-signals",
      displayName: "Trust & Credentials",
      description: "Social proof, certifications, reviews, and reasons to trust LockSafe",
      color: "#7C3AED",
      icon: "BadgeCheck",
      toneGuidelines: ["confident", "factual", "transparent"],
      topicExamples: [
        "Why all LockSafe locksmiths are DBS checked",
        "Our 4.9 star average across 500+ jobs",
        "What to look for in a trustworthy locksmith",
      ],
      hashtags: ["#TrustedLocksmith", "#DBSChecked", "#VerifiedLocksmith", "#SafeHands"],
      postsPerWeek: 1,
      preferredDays: ["wednesday"],
      preferredTimes: ["11:00"],
    },
    {
      name: "behind-scenes",
      displayName: "Behind the Scenes",
      description: "Day-in-the-life content, locksmith tools, how the platform works",
      color: "#D97706",
      icon: "Wrench",
      toneGuidelines: ["casual", "authentic", "curious"],
      topicExamples: [
        "A day in the life of a LockSafe locksmith",
        "The tools every pro locksmith carries",
        "How we verify and vet our locksmiths",
      ],
      hashtags: ["#BehindTheScenes", "#LocksmithLife", "#HowItWorks", "#MeetTheTeam"],
      postsPerWeek: 1,
      preferredDays: ["saturday"],
      preferredTimes: ["10:00"],
    },
    {
      name: "engagement",
      displayName: "Engagement & Community",
      description: "Questions, polls, fun facts, and community-building content",
      color: "#DB2777",
      icon: "MessageCircle",
      toneGuidelines: ["playful", "inviting", "conversational"],
      topicExamples: [
        "How many keys do you have on your keyring?",
        "Did you know this about pin tumbler locks?",
        "What's your biggest home security worry?",
      ],
      hashtags: ["#LocksmithFacts", "#HomeOwners", "#AskUs", "#CommunityQuestion"],
      postsPerWeek: 1,
      preferredDays: ["sunday"],
      preferredTimes: ["13:00"],
    },
  ];

  for (const pillar of pillars) {
    const result = await prisma.contentPillar.upsert({
      where: { name: pillar.name },
      update: pillar,
      create: pillar,
    });
    console.log(`  ✓ ContentPillar: ${result.displayName} (${result.id})`);
  }

  // ── 2. Autopilot Config ──────────────────────────────────────────
  const existingConfig = await prisma.autopilotConfig.findFirst();
  const publishTimes = {
    monday: ["09:00", "13:00", "18:00"],
    tuesday: ["09:00", "13:00", "18:00"],
    wednesday: ["09:00", "13:00", "18:00"],
    thursday: ["09:00", "13:00", "18:00"],
    friday: ["09:00", "13:00", "18:00"],
    saturday: ["10:00", "15:00"],
    sunday: ["11:00", "17:00"],
  };

  if (existingConfig) {
    await prisma.autopilotConfig.update({
      where: { id: existingConfig.id },
      data: {
        isEnabled: true,
        postsPerDay: 3,
        generateAheadDays: 7,
        requireApproval: false,
        publishToFacebook: true,
        publishToInstagram: true,
        publishTimes,
        pillarWeights: {},
        preferredFrameworks: ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"],
        notifyOnGeneration: true,
        notifyOnPublish: false,
        notificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || "admin@locksafe.uk",
      },
    });
    console.log(`  ✓ AutopilotConfig: updated (${existingConfig.id})`);
  } else {
    const config = await prisma.autopilotConfig.create({
      data: {
        isEnabled: true,
        postsPerDay: 3,
        generateAheadDays: 7,
        requireApproval: false,
        publishToFacebook: true,
        publishToInstagram: true,
        publishTimes,
        pillarWeights: {},
        preferredFrameworks: ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"],
        notifyOnGeneration: true,
        notifyOnPublish: false,
        notificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || "admin@locksafe.uk",
      },
    });
    console.log(`  ✓ AutopilotConfig: created (${config.id})`);
  }

  // ── 3. Social Account stubs ──────────────────────────────────────
  // Requires actual platform IDs + tokens in environment before seeding.
  // Each account is upserted by platform+accountId.

  const socialAccounts = [
    {
      platform: "FACEBOOK" as const,
      accountId: process.env.FACEBOOK_PAGE_ID || "PLACEHOLDER_PAGE_ID",
      accountName: "LockSafe UK",
      accountHandle: "locksafeuk",
      accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "PLACEHOLDER_TOKEN",
      pageId: process.env.FACEBOOK_PAGE_ID || "PLACEHOLDER_PAGE_ID",
      pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "PLACEHOLDER_TOKEN",
      isActive: !!(process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID),
    },
    {
      platform: "INSTAGRAM" as const,
      accountId: process.env.INSTAGRAM_ACCOUNT_ID || "PLACEHOLDER_ACCOUNT_ID",
      accountName: "LockSafe UK",
      accountHandle: "locksafeuk",
      accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "PLACEHOLDER_TOKEN",
      isActive: !!(process.env.INSTAGRAM_ACCOUNT_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
    },
    {
      platform: "TWITTER" as const,
      accountId: process.env.TWITTER_ACCESS_TOKEN ? "locksafeuk" : "PLACEHOLDER",
      accountName: "LockSafe UK",
      accountHandle: "locksafeuk",
      accessToken: process.env.TWITTER_ACCESS_TOKEN || "PLACEHOLDER_TOKEN",
      isActive: !!(process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_API_KEY),
    },
    {
      platform: "LINKEDIN" as const,
      accountId: process.env.LINKEDIN_ORGANIZATION_ID || "PLACEHOLDER_ORG_ID",
      accountName: "LockSafe UK",
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN || "PLACEHOLDER_TOKEN",
      isActive: !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID),
    },
  ];

  for (const account of socialAccounts) {
    try {
      await prisma.socialAccount.upsert({
        where: { platform_accountId: { platform: account.platform, accountId: account.accountId } },
        update: { accessToken: account.accessToken, isActive: account.isActive },
        create: account,
      });
      const status = account.isActive ? "✓ active" : "⚠ placeholder (set env var)";
      console.log(`  ${status} SocialAccount: ${account.platform} — ${account.accountName}`);
    } catch (err) {
      console.error(`  ✗ SocialAccount ${account.platform} failed:`, err);
    }
  }

  console.log("\n✅ Social seed complete.");
  console.log("\nNext steps:");
  console.log("  1. Set FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN in Vercel env");
  console.log("  2. Set INSTAGRAM_ACCOUNT_ID in Vercel env");
  console.log("  3. Set TWITTER_API_KEY + TWITTER_API_SECRET + TWITTER_ACCESS_TOKEN + TWITTER_ACCESS_SECRET");
  console.log("  4. Set LINKEDIN_ACCESS_TOKEN + LINKEDIN_ORGANIZATION_ID");
  console.log("  5. Re-run this script to update SocialAccount records with real tokens");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
