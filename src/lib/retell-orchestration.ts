import { prisma } from "@/lib/db";

type PublishResult = {
  ok: boolean;
  providerVersionId: string | null;
  message?: string;
};

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

  // Best-effort Retell sync. If endpoint contracts change, we still keep
  // local deployment audit trail and return a clear error.
  const response = await fetch(`https://api.retellai.com/v2/agent/${params.agentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      llm_id: params.llmId ?? undefined,
      prompt: params.systemPrompt,
      language: params.language,
      voice_id: params.voiceId ?? undefined,
      speaking_rate: params.speakingRate,
      first_message: params.greetingMessage ?? undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      providerVersionId: null,
      message: `Retell sync failed (${response.status}): ${text.slice(0, 500)}`,
    };
  }

  const data = (await response.json()) as Record<string, any>;
  const providerVersionId =
    (typeof data?.version_id === "string" && data.version_id) ||
    (typeof data?.id === "string" && data.id) ||
    `${params.agentId}:${Date.now()}`;

  return { ok: true, providerVersionId };
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
