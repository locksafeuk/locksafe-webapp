/**
 * One-off script: Update autopilot config for 1x/day at 4 PM UK (15:00 UTC)
 * Run: npx ts-node -P tsconfig.scripts.json scripts/_update-autopilot-cadence.ts
 */
import { prisma } from "../src/lib/db";

const DAILY_TIME = "15:00"; // 15:00 UTC = 16:00 BST = 4 PM UK

const publishTimes = {
  monday: [DAILY_TIME],
  tuesday: [DAILY_TIME],
  wednesday: [DAILY_TIME],
  thursday: [DAILY_TIME],
  friday: [DAILY_TIME],
  saturday: [DAILY_TIME],
  sunday: [DAILY_TIME],
};

async function main() {
  const existing = await prisma.autopilotConfig.findFirst();

  if (!existing) {
    console.log("No autopilot config found — creating one");
    const created = await prisma.autopilotConfig.create({
      data: {
        isEnabled: true,
        postsPerDay: 1,
        generateAheadDays: 7,
        requireApproval: false,
        publishToFacebook: true,
        publishToInstagram: false,
        publishTimes,
        pillarWeights: {},
        preferredFrameworks: ["justin-welsh", "russell-brunson", "nicholas-cole", "simon-sinek"],
        emotionalAngleRotation: ["trust", "urgency", "control", "benefit", "curiosity"],
        notifyOnGeneration: true,
        notifyOnPublish: true,
      },
    });
    console.log("Created config:", created.id);
    return;
  }

  const updated = await prisma.autopilotConfig.update({
    where: { id: existing.id },
    data: {
      postsPerDay: 1,
      requireApproval: false,
      publishToInstagram: false,
      publishTimes,
    },
  });

  console.log("✅ Autopilot config updated:");
  console.log("  postsPerDay:", updated.postsPerDay);
  console.log("  requireApproval:", updated.requireApproval);
  console.log("  publishTimes:", JSON.stringify(updated.publishTimes, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
