import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import { prisma } from "@/lib/db";
import { generateVoiceAgentPrompt } from "@/lib/retell-handler";
import { publishVoiceConfigVersion } from "@/lib/retell-orchestration";

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    throw new Error("RETELL_API_KEY is missing in environment");
  }

  const activeConfig = await prisma.voiceAgentConfig.findFirst({ where: { isActive: true } });
  if (!activeConfig) {
    throw new Error("No active voice config found");
  }

  const latest = await prisma.voiceAgentConfigVersion.findFirst({
    where: { configId: activeConfig.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const generatedPrompt = generateVoiceAgentPrompt();

  await prisma.voiceAgentConfig.update({
    where: { id: activeConfig.id },
    data: {
      systemPrompt: generatedPrompt,
      updatedAt: new Date(),
    },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const version = await prisma.voiceAgentConfigVersion.create({
    data: {
      configId: activeConfig.id,
      version: nextVersion,
      title: `Auto publish v${nextVersion}`,
      notes: "Generated from latest modular prompt and published via local script.",
      createdBy: "local-publisher",
      systemPrompt: generatedPrompt,
      greetingMessage: activeConfig.greetingMessage,
      fallbackMessage: activeConfig.fallbackMessage,
      language: activeConfig.language,
      speakingRate: activeConfig.speakingRate,
      voiceId: activeConfig.voiceId,
      realismProfile: activeConfig.realismProfile,
      maxCallDuration: activeConfig.maxCallDuration,
      silenceTimeout: activeConfig.silenceTimeout,
      enableRecording: activeConfig.enableRecording,
      businessHoursStart: activeConfig.businessHoursStart,
      businessHoursEnd: activeConfig.businessHoursEnd,
      afterHoursMessage: activeConfig.afterHoursMessage,
      enableDispatch: activeConfig.enableDispatch,
      enableBooking: activeConfig.enableBooking,
      enableFAQ: activeConfig.enableFAQ,
      enableEscalation: activeConfig.enableEscalation,
      isPaused: activeConfig.isPaused,
      pauseReason: activeConfig.pauseReason,
      blockedNumbers: activeConfig.blockedNumbers,
      retellAgentId: activeConfig.retellAgentId,
      retellLlmId: activeConfig.retellLlmId,
    },
  });

  const result = await publishVoiceConfigVersion({
    versionId: version.id,
    deployedBy: "local-publisher",
    dryRun: false,
  });

  if (!result.ok) {
    throw new Error(`Retell publish failed: ${result.error}`);
  }

  console.log("Publish succeeded", {
    versionId: version.id,
    providerVersionId: result.providerVersionId,
  });
}

main()
  .catch((error) => {
    console.error("Publish failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
