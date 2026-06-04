/**
 * Seed Agent records into the database.
 *
 * Run once to bootstrap the agent OS:
 *   npx ts-node -P tsconfig.scripts.json scripts/seed-agents.ts
 *
 * Safe to re-run — uses upsert so existing records are updated, not duplicated.
 */

import { PrismaClient } from "@prisma/client";
import {
  CEO_HEARTBEAT_CRON,
  COO_HEARTBEAT_CRON,
  CMO_HEARTBEAT_CRON,
  CTO_HEARTBEAT_CRON,
  COPYWRITER_HEARTBEAT_CRON,
  ADS_SPECIALIST_HEARTBEAT_CRON,
  SOCIAL_MEDIA_HEARTBEAT_CRON,
} from "../src/agents/heartbeat-schedules";

const prisma = new PrismaClient();

async function main() {
  console.log("🤖 Seeding LockSafe Agent OS...\n");

  // ── Tier 1: C-Suite executives (no parent) ──────────────────────────────

  const ceo = await prisma.agent.upsert({
    where: { name: "ceo" },
    create: {
      name: "ceo",
      displayName: "CEO Agent",
      role: "Chief Executive — strategic oversight, weekly briefings, cross-agent coordination",
      status: "active",
      skillsPath: "src/agents/ceo/SKILL.md",
      monthlyBudgetUsd: 100,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: CEO_HEARTBEAT_CRON,
      governanceLevel: "supervised",
      permissions: ["read_all", "delegate", "approve", "telegram_notify", "repair_system"],
    },
    update: {
      status: "active",
      heartbeatEnabled: true,
      permissions: ["read_all", "delegate", "approve", "telegram_notify", "repair_system"],
    },
  });
  console.log(`✅ CEO Agent: ${ceo.id}`);

  const coo = await prisma.agent.upsert({
    where: { name: "coo" },
    create: {
      name: "coo",
      displayName: "COO Agent",
      role: "Chief Operating Officer — job dispatch, locksmith matching, SLA monitoring",
      status: "active",
      skillsPath: "src/agents/coo/SKILL.md",
      monthlyBudgetUsd: 40,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: COO_HEARTBEAT_CRON,
      governanceLevel: "autonomous",
      permissions: ["read_jobs", "dispatch_jobs", "assign_locksmiths", "telegram_notify"],
    },
    update: {
      status: "active",
      heartbeatEnabled: true,
    },
  });
  console.log(`✅ COO Agent: ${coo.id}`);

  const cmo = await prisma.agent.upsert({
    where: { name: "cmo" },
    create: {
      name: "cmo",
      displayName: "CMO Agent",
      role: "Chief Marketing Officer — campaign oversight, content strategy, ad performance",
      status: "active",
      skillsPath: "src/agents/cmo/SKILL.md",
      monthlyBudgetUsd: 60,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: CMO_HEARTBEAT_CRON,
      governanceLevel: "supervised",
      permissions: ["read_marketing", "create_drafts", "approve_content", "telegram_notify"],
    },
    update: {
      status: "active",
      heartbeatEnabled: true,
    },
  });
  console.log(`✅ CMO Agent: ${cmo.id}`);

  const cto = await prisma.agent.upsert({
    where: { name: "cto" },
    create: {
      name: "cto",
      displayName: "CTO Agent",
      role: "Chief Technology Officer — system health, error monitoring, uptime alerts",
      status: "active",
      skillsPath: "src/agents/cto/SKILL.md",
      monthlyBudgetUsd: 80,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: CTO_HEARTBEAT_CRON,
      governanceLevel: "supervised",
      permissions: ["read_system", "read_errors", "telegram_notify", "repair_system"],
    },
    update: {
      status: "active",
      heartbeatEnabled: true,
      permissions: ["read_system", "read_errors", "telegram_notify", "repair_system"],
    },
  });
  console.log(`✅ CTO Agent: ${cto.id}`);

  // ── Tier 2: CMO subagents ───────────────────────────────────────────────

  const copywriter = await prisma.agent.upsert({
    where: { name: "copywriter" },
    create: {
      name: "copywriter",
      displayName: "Copywriter",
      role: "Ad copy and social post generation using PAS/AIDA/BAB frameworks",
      parentAgentId: cmo.id,
      status: "active",
      skillsPath: "src/agents/cmo/subagents/copywriter/SKILL.md",
      monthlyBudgetUsd: 20,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: COPYWRITER_HEARTBEAT_CRON,
      governanceLevel: "autonomous",
      permissions: ["create_content", "read_marketing"],
    },
    update: {
      status: "active",
      parentAgentId: cmo.id,
      heartbeatEnabled: true,
    },
  });
  console.log(`✅ Copywriter: ${copywriter.id}`);

  const adsSpecialist = await prisma.agent.upsert({
    where: { name: "ads-specialist" },
    create: {
      name: "ads-specialist",
      displayName: "Ads Specialist",
      role: "Google Ads and Meta campaign optimisation, bid management, performance analysis",
      parentAgentId: cmo.id,
      status: "active",
      skillsPath: "src/agents/cmo/subagents/ads-specialist/SKILL.md",
      monthlyBudgetUsd: 25,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: ADS_SPECIALIST_HEARTBEAT_CRON,
      governanceLevel: "supervised",
      permissions: ["read_ads", "create_ads", "pause_ads", "read_marketing"],
    },
    update: {
      status: "active",
      parentAgentId: cmo.id,
      heartbeatEnabled: true,
    },
  });
  console.log(`✅ Ads Specialist: ${adsSpecialist.id}`);

  const socialMedia = await prisma.agent.upsert({
    where: { name: "social-media" },
    create: {
      name: "social-media",
      displayName: "Social Media Agent",
      role: "Multi-platform social content generation and scheduling (Instagram, Facebook, Twitter/X, LinkedIn, TikTok)",
      parentAgentId: cmo.id,
      status: "active",
      skillsPath: "src/agents/cmo/subagents/social-media/SKILL.md",
      monthlyBudgetUsd: 15,
      budgetUsedUsd: 0,
      heartbeatEnabled: true,
      heartbeatCronExpr: SOCIAL_MEDIA_HEARTBEAT_CRON,
      governanceLevel: "autonomous",
      permissions: ["create_content", "schedule_posts", "read_marketing"],
    },
    update: {
      status: "active",
      parentAgentId: cmo.id,
      heartbeatEnabled: true,
    },
  });
  console.log(`✅ Social Media Agent: ${socialMedia.id}`);

  // ── Marketing Policy defaults ───────────────────────────────────────────
  // Only seed if no policy exists yet
  const existingPolicy = await prisma.marketingPolicy.findFirst();
  if (!existingPolicy) {
    await prisma.marketingPolicy.create({
      data: {
        platform: "global",
        autonomyEnabled: false,         // START supervised — enable manually
        maxDailySpend: 15,
        maxMonthlySpend: 300,
        autoApproveMaxBudget: 5,
        pauseRoasThreshold: 0.5,
        pauseGraceDays: 3,
        minImpressionsForPause: 500,
        notifyOnAutoAction: true,
      },
    });
    console.log("✅ MarketingPolicy (global): created with autonomy disabled");
  } else {
    console.log("ℹ️  MarketingPolicy already exists, skipping");
  }

  const agentCount = await prisma.agent.count();
  console.log(`\n🚀 Done! ${agentCount} agents in database.\n`);
  console.log("Next steps:");
  console.log("  1. Set AGENTS_ENABLED=true in Vercel env vars");
  console.log("  2. Run: npx ts-node -P tsconfig.scripts.json scripts/seed-social.ts");
  console.log("  3. Deploy: git push\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
