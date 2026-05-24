const sendAdminAlertMock = jest.fn().mockResolvedValue(true);
const mockAgentDecisionFindFirst = jest.fn();
const mockAgentDecisionCreate = jest.fn().mockResolvedValue({ id: "decision-1" });
const mockMarketingPolicyFindUnique = jest.fn().mockResolvedValue(null);
const mockMarketingPolicyUpdateMany = jest.fn().mockResolvedValue({ count: 0 });

jest.mock("@/lib/db", () => ({
  prisma: {
    agentDecision: {
      findFirst: (...args: unknown[]) => mockAgentDecisionFindFirst(...args),
      create: (...args: unknown[]) => mockAgentDecisionCreate(...args),
    },
    marketingPolicy: {
      findUnique: (...args: unknown[]) => mockMarketingPolicyFindUnique(...args),
      updateMany: (...args: unknown[]) => mockMarketingPolicyUpdateMany(...args),
    },
  },
}));

jest.mock("@/lib/telegram", () => ({
  sendAdminAlert: (...args: unknown[]) => sendAdminAlertMock(...args),
}));

describe("LLM router alerts", () => {
  const originalEnv = process.env;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OPENAI_API_KEY: "",
      OPENAI_FALLBACK_ENABLED: "false",
    };
    mockAgentDecisionFindFirst.mockReset();
    mockAgentDecisionCreate.mockClear();
    mockMarketingPolicyFindUnique.mockClear();
    mockMarketingPolicyUpdateMany.mockClear();
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    global.fetch = fetchMock as typeof fetch;
    sendAdminAlertMock.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sends a deduplicated circuit-trip alert with a cooldown override", async () => {
    mockAgentDecisionFindFirst.mockResolvedValueOnce(null);
    const { chat, Models } = await import("../llm-router");

    await expect(
      chat(Models.FAST, [{ role: "user", content: "ping" }], { timeoutMs: 1000 }),
    ).rejects.toThrow(/Local model failed/i);

    await expect(
      chat(Models.FAST, [{ role: "user", content: "ping" }], { timeoutMs: 1000 }),
    ).rejects.toThrow(/Local model failed/i);

    await expect(
      chat(Models.FAST, [{ role: "user", content: "ping" }], { timeoutMs: 1000 }),
    ).rejects.toThrow(/OpenAI fallback is disabled/i);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("bypasses Ollama when a fresh shared circuit-open marker exists", async () => {
    const recentOpen = new Date(Date.now() - 60_000);
    mockAgentDecisionFindFirst.mockResolvedValue({
      action: "llm-router:circuit-open",
      createdAt: recentOpen,
    });

    const { chat, Models } = await import("../llm-router");

    await expect(
      chat(Models.FAST, [{ role: "user", content: "ping" }], { timeoutMs: 1000 }),
    ).rejects.toThrow(/OpenAI fallback is disabled/);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendAdminAlertMock).not.toHaveBeenCalled();
  });

  it("uses OpenAI when runtime is explicitly disabled and fallback is armed", async () => {
    process.env = {
      ...originalEnv,
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
      OLLAMA_RUNTIME_ENABLED: "false",
      OPENAI_API_KEY: "sk-test",
      OPENAI_FALLBACK_ENABLED: "true",
    };
    mockAgentDecisionFindFirst.mockResolvedValue(null);
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url === "https://api.openai.com/v1/chat/completions") {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        } as Response;
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    const { chat, Models } = await import("../llm-router");

    const response = await chat(Models.FAST, [{ role: "user", content: "ping" }], {
      timeoutMs: 1000,
      allowOpenAIFallback: true,
      fallbackSeverity: "critical",
    });

    expect(response.usedFallback).toBe(true);
    expect(response.model).toBe("gpt-4o-mini");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("blocks OpenAI when runtime is disabled but fallback is not armed", async () => {
    process.env = {
      ...originalEnv,
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
      OLLAMA_RUNTIME_ENABLED: "false",
      OPENAI_API_KEY: "sk-test",
      OPENAI_FALLBACK_ENABLED: "false",
    };
    mockAgentDecisionFindFirst.mockResolvedValue(null);

    const { chat, Models } = await import("../llm-router");

    await expect(
      chat(Models.FAST, [{ role: "user", content: "ping" }], { timeoutMs: 1000 }),
    ).rejects.toThrow(/fallback is not allowed by policy/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("locks OpenAI fallback when Ollama circuit trips repeatedly", async () => {
    process.env = {
      ...originalEnv,
      OLLAMA_BASE_URL: "http://127.0.0.1:11434",
      OPENAI_API_KEY: "sk-test",
      OPENAI_FALLBACK_ENABLED: "true",
      AUTO_DISARM_OPENAI_FALLBACK_ON_CIRCUIT: "true",
      ALLOW_OPENAI_FALLBACK_DURING_CIRCUIT: "false",
    };

    mockAgentDecisionFindFirst.mockResolvedValue(null);
    mockMarketingPolicyUpdateMany.mockResolvedValue({ count: 1 });
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.includes("/api/chat")) {
        throw new Error("ollama down");
      }

      if (url === "https://api.openai.com/v1/chat/completions") {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "openai-ok" } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        } as Response;
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    const { chat, Models } = await import("../llm-router");

    await chat(Models.FAST, [{ role: "user", content: "ping1" }], {
      timeoutMs: 1000,
      allowOpenAIFallback: true,
      fallbackSeverity: "critical",
    });
    await chat(Models.FAST, [{ role: "user", content: "ping2" }], {
      timeoutMs: 1000,
      allowOpenAIFallback: true,
      fallbackSeverity: "critical",
    });

    await expect(
      chat(Models.FAST, [{ role: "user", content: "ping3" }], {
        timeoutMs: 1000,
        allowOpenAIFallback: true,
        fallbackSeverity: "critical",
      }),
    ).rejects.toThrow(/OpenAI fallback is disabled|fallback is not allowed/i);

    expect(mockMarketingPolicyUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("allows short fallback grace then forces retries back to Ollama", async () => {
    const nowSpy = jest.spyOn(Date, "now");
    let now = 1_700_000_000_000;
    nowSpy.mockImplementation(() => now);
    try {
      process.env = {
        ...originalEnv,
        OLLAMA_BASE_URL: "http://127.0.0.1:11434",
        OPENAI_API_KEY: "sk-test",
        OPENAI_FALLBACK_ENABLED: "true",
        AUTO_DISARM_OPENAI_FALLBACK_ON_CIRCUIT: "false",
        ALLOW_OPENAI_FALLBACK_DURING_CIRCUIT: "true",
        OPENAI_FALLBACK_GRACE_MS: "1",
      };

      mockAgentDecisionFindFirst.mockResolvedValue(null);
      fetchMock.mockImplementation(async (input: string | URL | Request) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

        if (url.includes("/api/chat")) {
          throw new Error("ollama down");
        }

        if (url === "https://api.openai.com/v1/chat/completions") {
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: "openai-ok" } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            }),
          } as Response;
        }

        throw new Error(`unexpected fetch: ${url}`);
      });

      const { chat, Models } = await import("../llm-router");

      await chat(Models.FAST, [{ role: "user", content: "ping1" }], {
        timeoutMs: 1000,
        allowOpenAIFallback: true,
        fallbackSeverity: "critical",
      });

      await chat(Models.FAST, [{ role: "user", content: "ping2" }], {
        timeoutMs: 1000,
        allowOpenAIFallback: true,
        fallbackSeverity: "critical",
      });

      await chat(Models.FAST, [{ role: "user", content: "ping3" }], {
        timeoutMs: 1000,
        allowOpenAIFallback: true,
        fallbackSeverity: "critical",
      });

      now += 10;

      await expect(
        chat(Models.FAST, [{ role: "user", content: "ping4" }], {
          timeoutMs: 1000,
          allowOpenAIFallback: true,
          fallbackSeverity: "critical",
        }),
      ).rejects.toThrow(/OpenAI fallback is disabled|fallback is not allowed/i);
    } finally {
      nowSpy.mockRestore();
    }
  });
});