/**
 * @jest-environment node
 *
 * Tests for GET /api/health — public health probe.
 */

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockRunCommandRaw = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    $runCommandRaw: (...args: unknown[]) => mockRunCommandRaw(...args),
  },
}));

// Global fetch — only used when Telegram is configured. We stub it so we never
// hit the network.
const originalFetch = global.fetch;

let GET: () => Promise<Response>;

beforeAll(async () => {
  // Ensure deterministic env BEFORE the route module is imported.
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_NOTIFICATIONS_ENABLED;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.OPENAI_API_KEY;

  const mod = await import("@/app/api/health/route");
  GET = mod.GET;
});

afterEach(() => {
  global.fetch = originalFetch;
  mockRunCommandRaw.mockReset();
});

describe("GET /api/health", () => {
  it("returns healthy when DB ping succeeds and integrations are unconfigured", async () => {
    mockRunCommandRaw.mockResolvedValueOnce({ ok: 1 });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.telegram.status).toBe("unconfigured");
    expect(body.checks.whatsapp.status).toBe("unconfigured");
    expect(body.checks.stripe.status).toBe("unconfigured");
    expect(body.checks.openai.status).toBe("unconfigured");
    expect(typeof body.timestamp).toBe("string");
    expect(body.webhooks).toEqual({
      telegram: "https://locksafe.uk/api/agent/telegram",
      whatsapp: "https://locksafe.uk/api/webhooks/whatsapp",
      stripe: "https://locksafe.uk/api/webhooks/stripe",
    });
  });

  it("returns unhealthy when the database ping fails", async () => {
    mockRunCommandRaw.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const res = await GET();
    expect(res.status).toBe(200); // health endpoint always returns 200; status field carries severity
    const body = await res.json();

    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.message).toMatch(/ECONNREFUSED/);
  });

  it("marks telegram check as error when bot token is invalid", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "bad-token";
    process.env.TELEGRAM_CHAT_ID = "1234";
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED = "true";

    mockRunCommandRaw.mockResolvedValueOnce({ ok: 1 });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, description: "Unauthorized" }),
    }) as unknown as typeof fetch;

    const res = await GET();
    const body = await res.json();

    expect(body.checks.telegram.status).toBe("error");
    expect(body.checks.telegram.message).toBe("Unauthorized");
    // Degraded but DB ok → not unhealthy
    expect(body.status).toBe("degraded");

    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_NOTIFICATIONS_ENABLED;
  });

  it("marks integrations as ok when env vars are populated", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.OPENAI_API_KEY = "sk-dummy";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "111";
    process.env.WHATSAPP_ACCESS_TOKEN = "tok";

    mockRunCommandRaw.mockResolvedValueOnce({ ok: 1 });

    const res = await GET();
    const body = await res.json();

    expect(body.checks.stripe.status).toBe("ok");
    expect(body.checks.openai.status).toBe("ok");
    expect(body.checks.whatsapp.status).toBe("ok");
    expect(body.status).toBe("healthy");

    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
  });
});
