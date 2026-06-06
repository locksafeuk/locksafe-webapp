/**
 * @jest-environment node
 *
 * Tests for the post-publish verifier.
 *
 * Includes a regression test that replays the 2026-06-02 failure (campaign
 * with 3 of 5 ad groups having zero keywords). With the verifier wired into
 * the cron, that campaign would have been auto-paused within 10 minutes
 * with a Telegram alert.
 */

// ─── In-memory mocks ───────────────────────────────────────────────────

interface MockAdGroup {
  id: string;
  name: string;
  status: string;
  resourceName: string;
  keywords: number; // count
  ads: number;      // count
}

interface MockCampaign {
  id: string;
  name: string;
  status: string;
  resourceName: string;
  adGroups: MockAdGroup[];
  // Forensic-validation settings (default to playbook-compliant)
  targetSearchNetwork?: boolean;
  targetContentNetwork?: boolean;
  targetPartnerSearchNetwork?: boolean;
  positiveGeoTargetType?: string;
  liveGeoTargets?: string[]; // location criteria currently on the campaign
}

const mockGoogleStore: {
  campaigns: Map<string, MockCampaign>;
  clientError: string | null;
  mutateCalls: Array<{ resource: string; ops: unknown }>;
} = { campaigns: new Map(), clientError: null, mutateCalls: [] };

const mockDraftStore: {
  drafts: Map<
    string,
    {
      id: string;
      name: string;
      accountId: string;
      googleCampaignId: string | null;
      status: string;
      verificationStatus?: string | null;
      lastVerifiedAt?: Date | null;
      verificationDetails?: unknown;
      pausedAt?: Date | null;
    }
  >;
} = { drafts: new Map() };

const mockTelegram: { alerts: Array<{ title: string; message: string; severity?: string; dedupeKey?: string }> } = { alerts: [] };

const mockAuditStore: {
  entries: Array<Record<string, unknown>>;
} = { entries: [] };

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    googleAdsCampaignDraft: {
      findUnique: async ({ where: { id }, select: _s }: { where: { id: string }, select?: unknown }) =>
        mockDraftStore.drafts.get(id) ?? null,
      update: async ({ where: { id }, data }: { where: { id: string }, data: Record<string, unknown> }) => {
        const existing = mockDraftStore.drafts.get(id);
        if (existing) mockDraftStore.drafts.set(id, { ...existing, ...data });
        return existing;
      },
    },
    googleAdsGeoAuditEntry: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        mockAuditStore.entries.push(data);
        return data;
      },
    },
  },
}));

jest.mock("@/lib/google-ads", () => {
  return {
    __esModule: true,
    buildResourceName: (cid: string, resource: string, id: string) =>
      `customers/${cid}/${resource}/${id}`,
    getGoogleAdsClientForAccount: async (_accountId: string) => {
      if (mockGoogleStore.clientError) return null;
      return {
        customerIdPlain: "1234567890",
        query: async <T>(gaql: string): Promise<T[]> => {
          // Naïve GAQL parser — just looks for the table + WHERE id
          const norm = gaql.replace(/\s+/g, " ").toLowerCase();
          if (norm.includes("from campaign ") || norm.includes("from campaign\n")) {
            const m = norm.match(/campaign\.id\s*=\s*(\d+)/);
            if (!m) return [] as T[];
            const camp = mockGoogleStore.campaigns.get(m[1]);
            if (!camp) return [] as T[];
            return [
              {
                campaign: {
                  id: camp.id,
                  name: camp.name,
                  status: camp.status,
                  resourceName: camp.resourceName,
                  networkSettings: {
                    targetGoogleSearch: true,
                    targetSearchNetwork:
                      camp.targetSearchNetwork === undefined ? false : camp.targetSearchNetwork,
                    targetContentNetwork:
                      camp.targetContentNetwork === undefined ? false : camp.targetContentNetwork,
                    targetPartnerSearchNetwork:
                      camp.targetPartnerSearchNetwork === undefined
                        ? false
                        : camp.targetPartnerSearchNetwork,
                  },
                  geoTargetTypeSetting: {
                    positiveGeoTargetType: camp.positiveGeoTargetType ?? "PRESENCE",
                    negativeGeoTargetType: "PRESENCE",
                  },
                },
              },
            ] as T[];
          }
          if (norm.includes("from campaign_criterion")) {
            const m = norm.match(/campaign\.id\s*=\s*(\d+)/);
            if (!m) return [] as T[];
            const camp = mockGoogleStore.campaigns.get(m[1]);
            if (!camp) return [] as T[];
            const ids = camp.liveGeoTargets ?? [];
            return ids.map((id) => ({
              campaignCriterion: {
                criterionId: id,
                status: "ENABLED",
                type: "LOCATION",
                location: { geoTargetConstant: `geoTargetConstants/${id}` },
                negative: false,
              },
            })) as T[];
          }
          if (norm.includes("from ad_group ")) {
            const m = norm.match(/campaign\.id\s*=\s*(\d+)/);
            if (!m) return [] as T[];
            const camp = mockGoogleStore.campaigns.get(m[1]);
            if (!camp) return [] as T[];
            return camp.adGroups
              .filter((ag) => ag.status !== "REMOVED")
              .map((ag) => ({
                adGroup: {
                  id: ag.id,
                  name: ag.name,
                  status: ag.status,
                  resourceName: ag.resourceName,
                },
              })) as T[];
          }
          if (norm.includes("from ad_group_criterion")) {
            const m = norm.match(/ad_group\.id\s*=\s*(\d+)/);
            if (!m) return [] as T[];
            const agId = m[1];
            for (const c of mockGoogleStore.campaigns.values()) {
              const ag = c.adGroups.find((x) => x.id === agId);
              if (ag) {
                return Array.from({ length: ag.keywords }, (_, i) => ({
                  adGroupCriterion: {
                    criterionId: String(i),
                    status: "ENABLED",
                    type: "KEYWORD",
                  },
                })) as T[];
              }
            }
            return [] as T[];
          }
          if (norm.includes("from ad_group_ad")) {
            const m = norm.match(/ad_group\.id\s*=\s*(\d+)/);
            if (!m) return [] as T[];
            const agId = m[1];
            for (const c of mockGoogleStore.campaigns.values()) {
              const ag = c.adGroups.find((x) => x.id === agId);
              if (ag) {
                return Array.from({ length: ag.ads }, (_, i) => ({
                  adGroupAd: { status: "ENABLED", ad: { id: String(i) } },
                })) as T[];
              }
            }
            return [] as T[];
          }
          return [] as T[];
        },
        mutate: async (resource: string, ops: unknown) => {
          mockGoogleStore.mutateCalls.push({ resource, ops });
          return { results: [] };
        },
      };
    },
  };
});

jest.mock("@/lib/telegram", () => ({
  __esModule: true,
  sendAdminAlert: async (alert: { title: string; message: string; severity?: string; dedupeKey?: string }) => {
    mockTelegram.alerts.push(alert);
    return true;
  },
}));

import {
  verifyPublishedCampaign,
  verifyAndActOnDraft,
} from "../google-ads-publish-verifier";

function makeCampaign(opts: {
  id: string;
  adGroupSpec: Array<{ name: string; keywords: number; ads: number }>;
}): MockCampaign {
  return {
    id: opts.id,
    name: `Campaign ${opts.id}`,
    status: "ENABLED",
    resourceName: `customers/1234567890/campaigns/${opts.id}`,
    adGroups: opts.adGroupSpec.map((ag, i) => ({
      id: String(Number(opts.id) * 100 + i),
      name: ag.name,
      status: "ENABLED",
      resourceName: `customers/1234567890/adGroups/${Number(opts.id) * 100 + i}`,
      keywords: ag.keywords,
      ads: ag.ads,
    })),
  };
}

function reset() {
  mockGoogleStore.campaigns.clear();
  mockGoogleStore.clientError = null;
  mockGoogleStore.mutateCalls = [];
  mockDraftStore.drafts.clear();
  mockTelegram.alerts = [];
  mockAuditStore.entries = [];
}

describe("google-ads-publish-verifier", () => {
  beforeEach(reset);

  describe("verifyPublishedCampaign — read-only ground-truth check", () => {
    it("returns ok when every ad group meets the per-ad-group floors", async () => {
      mockGoogleStore.campaigns.set(
        "100",
        makeCampaign({
          id: "100",
          adGroupSpec: [
            { name: "Locked Out", keywords: 12, ads: 1 },
            { name: "uPVC", keywords: 17, ads: 1 },
          ],
        }),
      );
      const r = await verifyPublishedCampaign("acct1", "100");
      expect(r.status).toBe("ok");
      expect(r.issues).toHaveLength(0);
      expect(r.adGroups).toHaveLength(2);
    });

    it("REGRESSION 2026-06-02: 3 of 5 themed ad groups empty → structural_failure", async () => {
      mockGoogleStore.campaigns.set(
        "200",
        makeCampaign({
          id: "200",
          adGroupSpec: [
            { name: "Emergency & 24hr", keywords: 0, ads: 0 },        // empty (locksmith policy)
            { name: "Locked Out", keywords: 12, ads: 1 },              // healthy (≥10 floor)
            { name: "Lock Change & Burglary", keywords: 0, ads: 0 },   // empty (locksmith policy)
            { name: "uPVC & Composite Doors", keywords: 17, ads: 1 },  // healthy
            { name: "Trust & USP", keywords: 0, ads: 0 },              // empty (locksmith policy)
          ],
        }),
      );
      const r = await verifyPublishedCampaign("acct1", "200");
      expect(r.status).toBe("structural_failure");
      const emptyNames = ["Emergency & 24hr", "Lock Change & Burglary", "Trust & USP"];
      for (const name of emptyNames) {
        expect(r.issues.some((i) => i.includes(name))).toBe(true);
      }
      // The two healthy ad groups should NOT have issues
      const lockedOut = r.adGroups.find((ag) => ag.name === "Locked Out");
      expect(lockedOut?.issues).toHaveLength(0);
    });

    it("flags an ad group with no ads even when keywords are healthy (Yorkshire | Final LC&B case)", async () => {
      mockGoogleStore.campaigns.set(
        "300",
        makeCampaign({
          id: "300",
          adGroupSpec: [
            { name: "Lock Change & Burglary", keywords: 16, ads: 0 },
          ],
        }),
      );
      const r = await verifyPublishedCampaign("acct1", "300");
      expect(r.status).toBe("structural_failure");
      expect(r.issues.some((i) => i.includes("Lock Change & Burglary") && i.includes("ads"))).toBe(true);
    });

    it("flags below-floor keyword count even if non-zero", async () => {
      mockGoogleStore.campaigns.set(
        "310",
        makeCampaign({
          id: "310",
          adGroupSpec: [{ name: "Sparse", keywords: 5, ads: 1 }],
        }),
      );
      const r = await verifyPublishedCampaign("acct1", "310");
      expect(r.status).toBe("structural_failure");
      expect(r.issues.some((i) => i.includes("5 keywords"))).toBe(true);
    });

    it("returns structural_failure when campaign has zero ad groups", async () => {
      mockGoogleStore.campaigns.set(
        "400",
        makeCampaign({ id: "400", adGroupSpec: [] }),
      );
      const r = await verifyPublishedCampaign("acct1", "400");
      expect(r.status).toBe("structural_failure");
      expect(r.issues[0]).toContain("zero ad groups");
    });

    it("returns api_error when campaign not found in Google", async () => {
      const r = await verifyPublishedCampaign("acct1", "999");
      expect(r.status).toBe("api_error");
      expect(r.error).toBe("campaign_not_found");
    });

    it("returns api_error when Google Ads client unavailable", async () => {
      mockGoogleStore.clientError = "no creds";
      const r = await verifyPublishedCampaign("acct1", "100");
      expect(r.status).toBe("api_error");
      expect(r.error).toBe("no_google_ads_client");
    });

    it("rejects malformed campaign IDs (defensive asInt)", async () => {
      const r = await verifyPublishedCampaign("acct1", "not-a-number");
      // Either api_error from the rejected query or campaign_not_found —
      // the key invariant is that we don't crash or send bad GAQL.
      expect(r.status).toBe("api_error");
    });
  });

  describe("verifyAndActOnDraft — auto-pause + Telegram alert", () => {
    it("pauses the campaign and sends an alert on structural_failure", async () => {
      mockGoogleStore.campaigns.set(
        "500",
        makeCampaign({
          id: "500",
          adGroupSpec: [
            { name: "Em & 24hr", keywords: 0, ads: 0 },
            { name: "Locked Out", keywords: 12, ads: 1 },
          ],
        }),
      );
      mockDraftStore.drafts.set("draft1", {
        id: "draft1",
        name: "London | Final",
        accountId: "acct1",
        googleCampaignId: "500",
        status: "PUBLISHED",
      });

      const r = await verifyAndActOnDraft("draft1");

      expect(r.status).toBe("structural_failure");
      // mutate was called to pause
      const pauseCall = mockGoogleStore.mutateCalls.find(
        (c) => c.resource === "campaigns",
      );
      expect(pauseCall).toBeDefined();
      const op = (pauseCall?.ops as Array<{ update: { status: string } }>)[0];
      expect(op.update.status).toBe("PAUSED");
      // Telegram alert fired
      expect(mockTelegram.alerts).toHaveLength(1);
      expect(mockTelegram.alerts[0].severity).toBe("error");
      expect(mockTelegram.alerts[0].dedupeKey).toBe("verify-fail:500");
      // Draft updated with verification status + PAUSED status
      const draft = mockDraftStore.drafts.get("draft1");
      expect(draft?.verificationStatus).toBe("structural_failure");
      expect(draft?.status).toBe("PAUSED");
      expect(draft?.pausedAt).toBeInstanceOf(Date);
    });

    it("does NOT pause or alert when the campaign is structurally ok", async () => {
      mockGoogleStore.campaigns.set(
        "600",
        makeCampaign({
          id: "600",
          adGroupSpec: [{ name: "Locked Out", keywords: 12, ads: 1 }],
        }),
      );
      mockDraftStore.drafts.set("draft2", {
        id: "draft2",
        name: "Healthy",
        accountId: "acct1",
        googleCampaignId: "600",
        status: "PUBLISHED",
      });

      const r = await verifyAndActOnDraft("draft2");
      expect(r.status).toBe("ok");
      expect(mockGoogleStore.mutateCalls).toHaveLength(0);
      expect(mockTelegram.alerts).toHaveLength(0);
      const draft = mockDraftStore.drafts.get("draft2");
      expect(draft?.verificationStatus).toBe("ok");
      expect(draft?.status).toBe("PUBLISHED"); // unchanged
    });

    it("throws when draft has no googleCampaignId", async () => {
      mockDraftStore.drafts.set("draft4", {
        id: "draft4",
        name: "Unpublished",
        accountId: "acct1",
        googleCampaignId: null,
        status: "APPROVED",
      });
      await expect(verifyAndActOnDraft("draft4")).rejects.toThrow(
        "not published",
      );
    });

    it("throws when draft does not exist", async () => {
      await expect(verifyAndActOnDraft("nope")).rejects.toThrow(
        "not found",
      );
    });
  });

  // ─── Forensic-validation traffic controls (playbook §15) ───────────────

  describe("forensic-validation traffic controls", () => {
    it("flags Search Partners on as structural_failure (auto-pause)", async () => {
      const c = makeCampaign({
        id: "800",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      c.targetSearchNetwork = true;
      mockGoogleStore.campaigns.set("800", c);
      const r = await verifyPublishedCampaign("acct1", "800");
      expect(r.status).toBe("structural_failure");
      expect(r.issues.some((i) => i.includes("Search Partners"))).toBe(true);
    });

    it("flags Display Network on as structural_failure", async () => {
      const c = makeCampaign({
        id: "810",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      c.targetContentNetwork = true;
      mockGoogleStore.campaigns.set("810", c);
      const r = await verifyPublishedCampaign("acct1", "810");
      expect(r.status).toBe("structural_failure");
      expect(r.issues.some((i) => i.includes("Display Network"))).toBe(true);
    });

    // URL expansion (campaign.url_expansion_opt_out) was PERFORMANCE_MAX
    // only and is REMOVED from current Google Ads API. The publish path no
    // longer sends it and the verifier no longer reads it. For SEARCH
    // campaigns, the equivalent control is AI Max for Search staying OFF
    // (default). Test removed — would assert behavior on a removed field.

    it("flags PRESENCE_OR_INTEREST geo targeting as structural_failure", async () => {
      const c = makeCampaign({
        id: "830",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      c.positiveGeoTargetType = "PRESENCE_OR_INTEREST";
      mockGoogleStore.campaigns.set("830", c);
      const r = await verifyPublishedCampaign("acct1", "830");
      expect(r.status).toBe("structural_failure");
      expect(r.issues.some((i) => i.includes("PRESENCE_OR_INTEREST"))).toBe(true);
    });
  });

  // ─── Per-campaign geo drift detection ──────────────────────────────────

  describe("per-campaign geo drift detection (warning, not failure)", () => {
    it("returns ok when live geo targets match expected exactly", async () => {
      const c = makeCampaign({
        id: "900",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      c.liveGeoTargets = ["1006517", "1006515"]; // Yorkshire-ish IDs
      mockGoogleStore.campaigns.set("900", c);
      const r = await verifyPublishedCampaign("acct1", "900", {
        expectedGeoTargets: ["1006517", "1006515"],
      });
      expect(r.status).toBe("ok");
      expect(r.warnings).toHaveLength(0);
    });

    it("returns drift_warning when live has an EXTRA geo target", async () => {
      const c = makeCampaign({
        id: "910",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      // expected = Yorkshire; live = Yorkshire + Manchester (an extra)
      c.liveGeoTargets = ["1006517", "1006515", "9999999"];
      mockGoogleStore.campaigns.set("910", c);
      const r = await verifyPublishedCampaign("acct1", "910", {
        expectedGeoTargets: ["1006517", "1006515"],
      });
      expect(r.status).toBe("drift_warning");
      expect(r.issues).toHaveLength(0); // not a hard failure
      expect(r.drift?.geoTargetsAdded).toEqual(["9999999"]);
      expect(r.drift?.geoTargetsRemoved).toEqual([]);
      expect(r.warnings.some((w) => w.includes("9999999"))).toBe(true);
    });

    it("returns drift_warning when live is MISSING an expected geo target", async () => {
      const c = makeCampaign({
        id: "920",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      c.liveGeoTargets = ["1006517"]; // missing 1006515
      mockGoogleStore.campaigns.set("920", c);
      const r = await verifyPublishedCampaign("acct1", "920", {
        expectedGeoTargets: ["1006517", "1006515"],
      });
      expect(r.status).toBe("drift_warning");
      expect(r.drift?.geoTargetsRemoved).toEqual(["1006515"]);
    });

    it("structural_failure takes precedence over drift_warning", async () => {
      const c = makeCampaign({
        id: "930",
        // empty ad group → structural failure
        adGroupSpec: [{ name: "ok", keywords: 0, ads: 0 }],
      });
      c.liveGeoTargets = ["9999999"]; // also drift
      mockGoogleStore.campaigns.set("930", c);
      const r = await verifyPublishedCampaign("acct1", "930", {
        expectedGeoTargets: ["1006517"],
      });
      expect(r.status).toBe("structural_failure");
    });
  });

  // ─── handleDriftWarning behaviour: no auto-pause, no error severity ────

  describe("verifyAndActOnDraft on drift_warning", () => {
    it("does NOT auto-pause the campaign on drift_warning", async () => {
      const c = makeCampaign({
        id: "1000",
        adGroupSpec: [{ name: "ok", keywords: 12, ads: 1 }],
      });
      c.liveGeoTargets = ["1006517", "9999999"]; // drift
      mockGoogleStore.campaigns.set("1000", c);
      mockDraftStore.drafts.set("draft-drift", {
        id: "draft-drift",
        name: "Drifty",
        accountId: "acct1",
        googleCampaignId: "1000",
        status: "PUBLISHED",
        // publishedSnapshot baseline = only 1006517
        // (we add it via a small hack: use draft.geoTargets fallback path)
      });
      // Patch the mock to return geoTargets for the draft fetch
      const existing = mockDraftStore.drafts.get("draft-drift")!;
      mockDraftStore.drafts.set("draft-drift", {
        ...existing,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(({ geoTargets: ["1006517"] } as any)),
      });

      const r = await verifyAndActOnDraft("draft-drift");

      expect(r.status).toBe("drift_warning");
      // No campaigns mutate (no pause)
      const pauseCalls = mockGoogleStore.mutateCalls.filter(
        (c2) => c2.resource === "campaigns",
      );
      expect(pauseCalls).toHaveLength(0);
      // Telegram alert fired at WARNING severity (not error)
      const alert = mockTelegram.alerts.find((a) =>
        a.title.includes("geo target drift"),
      );
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe("warning");
      expect(alert?.dedupeKey).toBe("geo-drift:1000");
      expect(alert?.message).toMatch(/revert/i);
      expect(alert?.message).toMatch(/accept/i);
      // Audit entry written for the forensic trail
      expect(mockAuditStore.entries).toHaveLength(1);
      const entry = mockAuditStore.entries[0];
      expect(entry.action).toBe("drift_detected");
      expect(entry.draftId).toBe("draft-drift");
      expect(entry.actedBy).toBe("cron");
      expect(entry.geoTargetsAdded).toEqual(["9999999"]);
      expect(entry.baselineSnapshot).toEqual(["1006517"]);
    });
  });
});
