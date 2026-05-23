jest.mock("@/lib/prisma", () => {
  const findFirst = jest.fn().mockResolvedValue(null);
  const create = jest.fn().mockResolvedValue({ id: "alert-1" });

  return {
    prisma: {
      agentDecision: {
        findFirst,
        create,
      },
    },
  };
});

const mockedFetch = jest.fn();

describe("sendAdminAlert dedupe", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_NOTIFICATIONS_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "bot-token",
      TELEGRAM_CHAT_ID: "chat-id",
    };
    jest.resetModules();
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      headers: { get: () => null },
    });
    global.fetch = mockedFetch as typeof fetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("suppresses repeated alerts when the cooldown override is set", async () => {
    const { sendAdminAlert } = await import("../telegram");

    await sendAdminAlert({
      title: "🔴 Ollama Circuit Tripped",
      message: "first alert",
      severity: "error",
      dedupeKey: "llm-router:ollama-circuit-tripped",
      cooldownMsOverride: 30 * 60_000,
      bypassPolicyGate: true,
    });

    await sendAdminAlert({
      title: "🔴 Ollama Circuit Tripped",
      message: "second alert",
      severity: "error",
      dedupeKey: "llm-router:ollama-circuit-tripped",
      cooldownMsOverride: 30 * 60_000,
      bypassPolicyGate: true,
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});