/**
 * @jest-environment node
 *
 * Tests for the autonomous Google Ads draft throttle.
 *
 * Mocks prisma with a tiny in-memory store so we exercise the real branching
 * logic against the four gates (feature flag, backlog, interval, real data).
 */

const mockStore: {
  approvals: Array<{ status: string; actionType: string }>;
  drafts: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
  }>;
} = { approvals: [], drafts: [] };

jest.mock("@/lib/db", () => {
  return {
    __esModule: true,
    default: {
      agentApproval: {
        count: async ({
          where,
        }: {
          where: { status?: string; actionType?: string };
        }) =>
          mockStore.approvals.filter(
            (a) =>
              (!where.status || a.status === where.status) &&
              (!where.actionType || a.actionType === where.actionType),
          ).length,
      },
      googleAdsCampaignDraft: {
        findFirst: async ({
          where,
          orderBy,
        }: {
          where?: {
            status?: string | { in?: string[] };
            createdAt?: { gte?: Date };
            updatedAt?: { gte?: Date };
            OR?: Array<Record<string, { gt?: number }>>;
          };
          orderBy?: { createdAt?: "asc" | "desc" };
        }) => {
          let rows = mockStore.drafts.slice();
          if (where?.createdAt?.gte) {
            const cutoff = where.createdAt.gte;
            rows = rows.filter((r) => r.createdAt >= cutoff);
          }
          if (where?.updatedAt?.gte) {
            const cutoff = where.updatedAt.gte;
            rows = rows.filter((r) => r.updatedAt >= cutoff);
          }
          if (where?.status) {
            const status = where.status;
            if (typeof status === "string") {
              rows = rows.filter((r) => r.status === status);
            } else if (status.in) {
              const allowed = status.in;
              rows = rows.filter((r) => allowed.includes(r.status));
            }
          }
          if (where?.OR) {
            rows = rows.filter((r) =>
              where.OR!.some((cond) =>
                Object.entries(cond).some(([k, v]) =>
                  v.gt !== undefined && (r as Record<string, unknown>)[k] != null
                    ? ((r as Record<string, unknown>)[k] as number) > v.gt
                    : false,
                ),
              ),
            );
          }
          if (orderBy?.createdAt === "desc") {
            rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return rows[0] ?? null;
        },
      },
    },
  };
});

import {
  shouldCreateAutonomousDraft,
  isAutonomousCampaignDraftsDisabled,
  THROTTLE_DEFAULTS,
} from "../google-ads-draft-throttle";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function reset() {
  mockStore.approvals = [];
  mockStore.drafts = [];
}

describe("google-ads-draft-throttle", () => {
  const ORIG_FLAG = process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS;

  beforeEach(() => {
    reset();
    delete process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS;
  });

  afterAll(() => {
    process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS = ORIG_FLAG;
  });

  describe("feature flag", () => {
    it("isAutonomousCampaignDraftsDisabled defaults false (permissive)", () => {
      expect(isAutonomousCampaignDraftsDisabled()).toBe(false);
    });

    it("flips to true only on exactly 'false'", () => {
      process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS = "false";
      expect(isAutonomousCampaignDraftsDisabled()).toBe(true);
    });

    it("stays false for ambiguous values", () => {
      for (const v of ["0", "no", "off", "FALSE", "False"]) {
        process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS = v;
        expect(isAutonomousCampaignDraftsDisabled()).toBe(false);
      }
    });

    it("blocks shouldCreateAutonomousDraft when env is 'false'", async () => {
      process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS = "false";
      // Seed real-data so we can isolate the feature flag.
      mockStore.drafts.push({
        id: "d1",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("feature_flag_off");
    });
  });

  describe("pending backlog cap", () => {
    it("blocks when pending publish_google_ads_draft >= max", async () => {
      mockStore.approvals = Array.from({ length: 3 }, () => ({
        status: "pending",
        actionType: "publish_google_ads_draft",
      }));
      // Seed real-data so it's not the gate that fires.
      mockStore.drafts.push({
        id: "d1",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) {
        expect(r.reason).toBe("pending_backlog");
        expect(r.meta?.pendingCount).toBe(3);
      }
    });

    it("ignores rejected/approved approvals when counting", async () => {
      mockStore.approvals = [
        { status: "rejected", actionType: "publish_google_ads_draft" },
        { status: "approved", actionType: "publish_google_ads_draft" },
        { status: "pending", actionType: "publish_google_ads_draft" },
      ];
      mockStore.drafts.push({
        id: "d1",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(true);
    });

    it("ignores approvals of other action types", async () => {
      mockStore.approvals = Array.from({ length: 10 }, () => ({
        status: "pending",
        actionType: "some_other_action",
      }));
      mockStore.drafts.push({
        id: "d1",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(true);
    });

    it("respects maxPendingApprovals override", async () => {
      mockStore.approvals = [
        { status: "pending", actionType: "publish_google_ads_draft" },
      ];
      mockStore.drafts.push({
        id: "d1",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({
        agentName: "cmo",
        maxPendingApprovals: 1,
      });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("pending_backlog");
    });
  });

  describe("min interval gate (72h default)", () => {
    it("blocks when most recent draft is younger than minIntervalHours", async () => {
      mockStore.drafts.push({
        id: "recent",
        name: "fresh",
        status: "PENDING_APPROVAL",
        createdAt: new Date(Date.now() - 1 * HOUR),
        updatedAt: new Date(),
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) {
        expect(r.reason).toBe("too_soon_after_last_draft");
        expect(r.nextAttemptAt).toBeInstanceOf(Date);
      }
    });

    it("allows when most recent draft is older than minIntervalHours", async () => {
      mockStore.drafts.push({
        id: "old-pub",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 5 * DAY),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(true);
    });

    it("uses 72h as the default per the playbook decision", async () => {
      expect(THROTTLE_DEFAULTS.MIN_INTERVAL_HOURS).toBe(72);
    });

    it("respects minIntervalHours override (smaller window)", async () => {
      // Draft made 5h ago — default 72h would block, 4h override allows.
      mockStore.drafts.push({
        id: "d",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 5 * HOUR),
        updatedAt: new Date(),
        totalImpressions: 100,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({
        agentName: "cmo",
        minIntervalHours: 4,
      });
      expect(r.allowed).toBe(true);
    });
  });

  describe("real-data gate", () => {
    it("blocks when no PUBLISHED draft has any impressions/clicks/conversions", async () => {
      mockStore.drafts.push({
        id: "published-zero",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("no_real_data_yet");
    });

    it("allows when a PUBLISHED draft has impressions", async () => {
      mockStore.drafts.push({
        id: "p",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 250,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(true);
    });

    it("allows when a PUBLISHED draft has conversions only", async () => {
      mockStore.drafts.push({
        id: "p",
        name: "x",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 1,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(true);
    });

    it("ignores DRAFT/PENDING_APPROVAL when checking real data", async () => {
      mockStore.drafts.push({
        id: "pending-with-fake-metrics",
        name: "x",
        status: "PENDING_APPROVAL",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 999,
        totalClicks: 999,
        totalConversions: 999,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("no_real_data_yet");
    });

    it("skipRealDataGate:true bypasses the real-data check", async () => {
      const r = await shouldCreateAutonomousDraft({
        agentName: "cmo",
        skipRealDataGate: true,
      });
      expect(r.allowed).toBe(true);
    });
  });

  describe("bypass", () => {
    it("bypass:true short-circuits to allowed regardless of every gate", async () => {
      process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS = "false";
      mockStore.approvals = Array.from({ length: 50 }, () => ({
        status: "pending",
        actionType: "publish_google_ads_draft",
      }));
      mockStore.drafts.push({
        id: "fresh",
        name: "x",
        status: "PENDING_APPROVAL",
        createdAt: new Date(),
        updatedAt: new Date(),
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({
        agentName: "admin",
        bypass: true,
      });
      expect(r.allowed).toBe(true);
    });
  });

  describe("gate ordering — fail-fast on first violation", () => {
    it("feature flag wins over backlog", async () => {
      process.env.ENABLE_AUTONOMOUS_CAMPAIGN_DRAFTS = "false";
      mockStore.approvals = Array.from({ length: 10 }, () => ({
        status: "pending",
        actionType: "publish_google_ads_draft",
      }));
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("feature_flag_off");
    });

    it("backlog wins over interval", async () => {
      mockStore.approvals = Array.from({ length: 10 }, () => ({
        status: "pending",
        actionType: "publish_google_ads_draft",
      }));
      mockStore.drafts.push({
        id: "recent",
        name: "x",
        status: "PENDING_APPROVAL",
        createdAt: new Date(Date.now() - 1 * HOUR),
        updatedAt: new Date(),
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("pending_backlog");
    });

    it("interval wins over real-data", async () => {
      mockStore.drafts.push({
        id: "recent",
        name: "x",
        status: "PENDING_APPROVAL",
        createdAt: new Date(Date.now() - 1 * HOUR),
        updatedAt: new Date(),
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toBe("too_soon_after_last_draft");
    });
  });

  describe("REGRESSION — 2026-06-03 backlog scenario", () => {
    it("blocks new drafts when a 139-approval backlog exists", async () => {
      mockStore.approvals = Array.from({ length: 139 }, () => ({
        status: "pending",
        actionType: "publish_google_ads_draft",
      }));
      mockStore.drafts.push({
        id: "p",
        name: "London Emergency Lockout",
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - 10 * DAY),
        updatedAt: new Date(),
        totalImpressions: 500,
        totalClicks: 20,
        totalConversions: 1,
      });
      const r = await shouldCreateAutonomousDraft({ agentName: "cmo" });
      expect(r.allowed).toBe(false);
      if (!r.allowed) {
        expect(r.reason).toBe("pending_backlog");
        expect(r.meta?.pendingCount).toBe(139);
      }
    });
  });
});
