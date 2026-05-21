import { prisma } from "@/lib/db";
import { Retell } from "retell-sdk";

type PublishResult = {
  ok: boolean;
  providerVersionId: string | null;
  message?: string;
};

function normalizeSpeakingRate(value: number) {
  if (!Number.isFinite(value)) return 0.96;
  const clamped = Math.min(1.1, Math.max(0.85, value));
  return +clamped.toFixed(2);
}

async function syncVersionToRetell(params: {
  agentId: string;
  llmId?: string | null;
  systemPrompt: string;
  language: string;
  voiceId?: string | null;
  speakingRate: number;
  greetingMessage?: string | null;
}): Promise<PublishResult> {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      providerVersionId: null,
      message: "RETELL_API_KEY is missing",
    };
  }

  try {
    const client = new Retell({ apiKey });

    const existingAgent = await client.agent.retrieve(params.agentId);
    const derivedLlmId =
      params.llmId ??
      (((existingAgent as any)?.response_engine?.type === "retell-llm"
        ? (existingAgent as any)?.response_engine?.llm_id
        : null) as string | null);

    if (derivedLlmId) {
      await client.llm.update(derivedLlmId, {
        general_prompt: params.systemPrompt,
        begin_message: params.greetingMessage ?? undefined,
      } as any);
    }

    const updatedAgent = await client.agent.update(params.agentId, {
      language: params.language as any,
      voice_id: params.voiceId ?? undefined,
      voice_speed: normalizeSpeakingRate(params.speakingRate),
    } as any);

    const providerVersionId =
      String((updatedAgent as any)?.version ?? "") ||
      `${params.agentId}:${Date.now()}`;

    return { ok: true, providerVersionId };
  } catch (error: any) {
    return {
      ok: false,
      providerVersionId: null,
      message: `Retell sync failed: ${error?.message ?? "Unknown Retell SDK error"}`,
    };
  }
}

export async function publishVoiceConfigVersion(params: {
  versionId: string;
  deployedBy: string;
  dryRun?: boolean;
}) {
  const version = await prisma.voiceAgentConfigVersion.findUnique({
    where: { id: params.versionId },
  });

  if (!version) {
    return { ok: false, status: 404, error: "Version not found" };
  }

  if (!version.retellAgentId) {
    return { ok: false, status: 400, error: "Version is missing retellAgentId" };
  }

  await prisma.voiceAgentConfigVersion.update({
    where: { id: version.id },
    data: { publishStatus: "publishing", publishError: null },
  });

  let publish: PublishResult;
  if (params.dryRun) {
    publish = { ok: true, providerVersionId: `dry-run-${Date.now()}` };
  } else {
    publish = await syncVersionToRetell({
      agentId: version.retellAgentId,
      llmId: version.retellLlmId,
      systemPrompt: version.systemPrompt,
      language: version.language,
      voiceId: version.voiceId,
      speakingRate: version.speakingRate,
      greetingMessage: version.greetingMessage,
    });
  }

  if (!publish.ok) {
    await prisma.voiceAgentConfigVersion.update({
      where: { id: version.id },
      data: {
        publishStatus: "failed",
        publishError: publish.message ?? "Unknown publish error",
      },
    });

    await prisma.voiceConfigDeployment.create({
      data: {
        versionId: version.id,
        status: "failed",
        provider: "retell",
        providerAgentId: version.retellAgentId,
        providerLlmId: version.retellLlmId,
        notes: publish.message,
        deployedBy: params.deployedBy,
      },
    });

    return { ok: false, status: 502, error: publish.message ?? "Publish failed" };
  }

  await prisma.voiceAgentConfigVersion.updateMany({
    where: { configId: version.configId, isDeployed: true },
    data: { isDeployed: false, deployedAt: null, deployedBy: null },
  });

  const deployedVersion = await prisma.voiceAgentConfigVersion.update({
    where: { id: version.id },
    data: {
      isDeployed: true,
      deployedAt: new Date(),
      deployedBy: params.deployedBy,
      publishStatus: "published",
      publishedAt: new Date(),
      retellVersionId: publish.providerVersionId,
      publishError: null,
    },
  });

  await prisma.voiceConfigDeployment.create({
    data: {
      versionId: version.id,
      status: "deployed",
      provider: "retell",
      providerAgentId: version.retellAgentId,
      providerLlmId: version.retellLlmId,
      providerVersionId: publish.providerVersionId,
      deployedBy: params.deployedBy,
      notes: params.dryRun ? "Dry run publish" : "Published to Retell",
    },
  });

  // Promote snapshot fields to active config so local runtime mirrors deployed version.
  await prisma.voiceAgentConfig.update({
    where: { id: version.configId },
    data: {
      systemPrompt: version.systemPrompt,
      greetingMessage: version.greetingMessage,
      fallbackMessage: version.fallbackMessage,
      language: version.language,
      speakingRate: version.speakingRate,
      voiceId: version.voiceId,
      realismProfile: version.realismProfile,
      maxCallDuration: version.maxCallDuration,
      silenceTimeout: version.silenceTimeout,
      enableRecording: version.enableRecording,
      businessHoursStart: version.businessHoursStart,
      businessHoursEnd: version.businessHoursEnd,
      afterHoursMessage: version.afterHoursMessage,
      enableDispatch: version.enableDispatch,
      enableBooking: version.enableBooking,
      enableFAQ: version.enableFAQ,
      enableEscalation: version.enableEscalation,
      isPaused: version.isPaused,
      pauseReason: version.pauseReason,
      blockedNumbers: version.blockedNumbers,
      retellAgentId: version.retellAgentId,
      retellLlmId: version.retellLlmId,
    },
  });

  return {
    ok: true,
    status: 200,
    deployment: deployedVersion,
    providerVersionId: publish.providerVersionId,
  };
}
