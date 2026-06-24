/**
 * @jest-environment node
 *
 * The Meta campaign tools used to crash with "Malformed ObjectID" when an agent
 * passed a Google Ads numeric id (CEO analyzeCampaign failed 29/29). They must
 * now return an instructive error and never hit Prisma for a non-ObjectId id.
 */
const mockUpdate = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    adCampaign: {
      update: (...a: unknown[]) => mockUpdate(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));

import {
  updateCampaignStatusTool,
  analyzeCampaignTool,
  getCampaignPerformanceTool,
} from "@/agents/tools/marketing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx: any = { agentId: "x", agentName: "CMO", permissions: ["cmo"], budgetRemaining: 100 };
const GOOGLE_ID = "23911810467"; // 11-digit Google numeric id
const META_ID = "507f1f77bcf86cd799439011"; // 24-hex ObjectId

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockResolvedValue({ name: "C", status: "PAUSED", updatedAt: new Date() });
  mockFindUnique.mockResolvedValue({ id: META_ID, name: "C", status: "ACTIVE", totalImpressions: 100, totalClicks: 1, totalSpend: 5, totalConversions: 0 });
  mockFindMany.mockResolvedValue([]);
});

it("updateCampaignStatus rejects a Google id with guidance, no DB call", async () => {
  const r = await updateCampaignStatusTool.execute({ campaignId: GOOGLE_ID, action: "pause" }, ctx);
  expect(r.success).toBe(false);
  expect(r.error).toMatch(/not an internal Meta AdCampaign id/i);
  expect(r.error).toMatch(/getGoogleAdsCampaigns/);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("updateCampaignStatus proceeds for a valid Meta ObjectId", async () => {
  const r = await updateCampaignStatusTool.execute({ campaignId: META_ID, action: "pause" }, ctx);
  expect(r.success).toBe(true);
  expect(mockUpdate).toHaveBeenCalled();
});

it("analyzeCampaign rejects a Google id with guidance, no DB call", async () => {
  const r = await analyzeCampaignTool.execute({ campaignId: GOOGLE_ID }, ctx);
  expect(r.success).toBe(false);
  expect(r.error).toMatch(/not an internal Meta AdCampaign id/i);
  expect(mockFindUnique).not.toHaveBeenCalled();
});

it("getCampaignPerformance rejects a Google id but allows the no-id (all campaigns) call", async () => {
  const bad = await getCampaignPerformanceTool.execute({ campaignId: GOOGLE_ID }, ctx);
  expect(bad.success).toBe(false);
  expect(mockFindMany).not.toHaveBeenCalled();

  const all = await getCampaignPerformanceTool.execute({}, ctx);
  expect(all.success).toBe(true);
  expect(mockFindMany).toHaveBeenCalled();
});
