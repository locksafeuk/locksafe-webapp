/**
 * @jest-environment node
 *
 * Tests the per-recipient idempotency of the §40 auto-fire cron: it must send
 * only to the unsent remainder, never double-send (atomic claim), and release
 * the claim on a failed send so it retries.
 */
import { NextRequest } from "next/server";

const mockLocksmithFindMany = jest.fn();
const mockDeliveryFindMany = jest.fn();
const mockDeliveryCreate = jest.fn();
const mockDeliveryUpdate = jest.fn();
const mockDeliveryDelete = jest.fn();
const mockSendTemplate = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    locksmith: { findMany: (...a: unknown[]) => mockLocksmithFindMany(...a) },
    templateBroadcastDelivery: {
      findMany: (...a: unknown[]) => mockDeliveryFindMany(...a),
      create: (...a: unknown[]) => mockDeliveryCreate(...a),
      update: (...a: unknown[]) => mockDeliveryUpdate(...a),
      delete: (...a: unknown[]) => mockDeliveryDelete(...a),
    },
  },
}));
jest.mock("@/lib/cron-auth", () => ({ verifyCronAuth: () => true }));
jest.mock("@/lib/telegram", () => ({ sendAdminAlert: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/whatsapp-business", () => ({
  sendTemplateMessage: (...a: unknown[]) => mockSendTemplate(...a),
}));
jest.mock("@/lib/phone", () => ({ normalizePhoneNumber: (p: string) => p }));

const CRON_SID = "HXtest123";

function req() {
  return new NextRequest("https://www.locksafe.uk/api/cron/lockie-template-auto-fire", {
    method: "POST",
    headers: new Headers({ "x-vercel-cron": "1" }),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: (r: NextRequest) => Promise<any>;

beforeAll(async () => {
  process.env.TWILIO_CONTENT_SID_APP_UPDATE_NUDGE_V1 = CRON_SID;
  process.env.TWILIO_ACCOUNT_SID = "ACxxx";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  // Twilio approval fetch → approved
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ whatsapp: { status: "approved" } }),
  }) as unknown as typeof fetch;
  POST = (await import("@/app/api/cron/lockie-template-auto-fire/route")).POST;
});

beforeEach(() => {
  jest.clearAllMocks();
  // 3 app_missing targets (no token, has phone)
  mockLocksmithFindMany.mockResolvedValue([
    { id: "a", name: "A", phone: "+447100000001", nativeDeviceToken: null },
    { id: "b", name: "B", phone: "+447100000002", nativeDeviceToken: null },
    { id: "c", name: "C", phone: "+447100000003", nativeDeviceToken: null },
  ]);
  mockDeliveryCreate.mockImplementation(async ({ data }: { data: { recipientId: string } }) => ({
    id: `claim-${data.recipientId}`,
  }));
  mockDeliveryUpdate.mockResolvedValue({});
  mockDeliveryDelete.mockResolvedValue({});
  mockSendTemplate.mockResolvedValue({ success: true, messageId: "SM1" });
});

it("sends only to the unsent remainder (skips already-sent recipients)", async () => {
  mockDeliveryFindMany.mockResolvedValue([{ recipientId: "a" }]); // a already sent
  const res = await POST(req());
  const body = await res.json();
  expect(body.fired.whatsappOk).toBe(2); // b and c only
  expect(body.fired.previouslySent).toBe(1);
  expect(mockSendTemplate).toHaveBeenCalledTimes(2);
  // claims created for b and c, not a
  const claimed = mockDeliveryCreate.mock.calls.map((c) => c[0].data.recipientId).sort();
  expect(claimed).toEqual(["b", "c"]);
});

it("no-ops when every recipient already received it", async () => {
  mockDeliveryFindMany.mockResolvedValue([
    { recipientId: "a" }, { recipientId: "b" }, { recipientId: "c" },
  ]);
  const res = await POST(req());
  const body = await res.json();
  expect(body.skipped).toBe(true);
  expect(body.reason).toMatch(/already fired to all/i);
  expect(mockSendTemplate).not.toHaveBeenCalled();
});

it("skips a recipient claimed by a concurrent run (P2002) without sending", async () => {
  mockDeliveryFindMany.mockResolvedValue([]);
  mockDeliveryCreate.mockImplementation(async ({ data }: { data: { recipientId: string } }) => {
    if (data.recipientId === "b") {
      const e = new Error("dup") as Error & { code: string };
      e.code = "P2002";
      throw e;
    }
    return { id: `claim-${data.recipientId}` };
  });
  const res = await POST(req());
  const body = await res.json();
  expect(body.fired.skippedClaimed).toBe(1);
  expect(body.fired.whatsappOk).toBe(2); // a and c
  expect(mockSendTemplate).toHaveBeenCalledTimes(2);
});

it("releases the claim (delete) on a failed send so it retries next run", async () => {
  mockDeliveryFindMany.mockResolvedValue([]);
  mockSendTemplate.mockImplementation(async (phone: string) =>
    phone === "+447100000002"
      ? { success: false, error: "63016" }
      : { success: true, messageId: "SM1" },
  );
  const res = await POST(req());
  const body = await res.json();
  expect(body.fired.failed).toBe(1);
  expect(body.fired.whatsappOk).toBe(2);
  // the failed recipient's claim must be deleted (released for retry)
  expect(mockDeliveryDelete).toHaveBeenCalledWith({ where: { id: "claim-b" } });
});
