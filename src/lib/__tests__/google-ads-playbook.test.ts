/**
 * @jest-environment node
 *
 * Unit tests for the self-learning Google Ads campaign playbook.
 * Prisma is mocked with a tiny in-memory store so we exercise the real
 * read / upsert / seed / reflection-distillation logic.
 */

// In-memory store (name starts with "mock" so jest.mock's factory may use it).
const mockStore: {
  agents: Map<string, { id: string; name: string }>;
  memories: Array<Record<string, unknown>>;
  idc: number;
} = { agents: new Map(), memories: [], idc: 0 };

jest.mock("@/lib/db", () => {
  const prismaMock = {
    agent: {
      findUnique: async ({ where: { name } }: { where: { name: string } }) =>
        mockStore.agents.get(name) ?? null,
    },
    agentMemory: {
      findMany: async ({
        where,
        orderBy,
      }: {
        where: { agentId: string; category?: string };
        orderBy?: Array<Record<string, "asc" | "desc">>;
      }) => {
        let rows = mockStore.memories.filter(
          (m) =>
            m.agentId === where.agentId &&
            (where.category === undefined || m.category === where.category),
        );
        if (Array.isArray(orderBy)) {
          rows = [...rows].sort((a, b) => {
            for (const clause of orderBy) {
              const [field, dir] = Object.entries(clause)[0];
              const av = a[field] as number | Date;
              const bv = b[field] as number | Date;
              const an = av instanceof Date ? av.getTime() : (av as number);
              const bn = bv instanceof Date ? bv.getTime() : (bv as number);
              if (an !== bn) return dir === "desc" ? bn - an : an - bn;
            }
            return 0;
          });
        }
        return rows.map((m) => ({ ...m }));
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `m${++mockStore.idc}`, updatedAt: new Date(), ...data };
        mockStore.memories.push(row);
        return { ...row };
      },
      update: async ({
        where: { id },
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const row = mockStore.memories.find((m) => m.id === id);
        if (row) Object.assign(row, data, { updatedAt: new Date() });
        return row ? { ...row } : null;
      },
    },
  };
  return { __esModule: true, default: prismaMock, prisma: prismaMock };
});

import {
  SEED_PLAYBOOK_RULES,
  seedPlaybook,
  getPlaybookRules,
  renderPlaybookForPrompt,
  renderPlaybookMarkdown,
  upsertPlaybookRule,
  applyReflectionToPlaybook,
} from "@/lib/google-ads-playbook";

beforeEach(() => {
  mockStore.agents = new Map();
  mockStore.memories = [];
  mockStore.idc = 0;
});

function withAgent() {
  mockStore.agents.set("ads-specialist", { id: "agent_ads", name: "ads-specialist" });
}

describe("playbook — no agent present", () => {
  test("reads return empty and never throw", async () => {
    expect(await getPlaybookRules()).toEqual([]);
    expect(await renderPlaybookForPrompt()).toBe("");
    const seeded = await seedPlaybook();
    expect(seeded.created).toBe(0);
    expect(seeded.skipped).toBe(SEED_PLAYBOOK_RULES.length);
  });
});

describe("playbook — seeding", () => {
  test("seeds the baseline template, idempotently", async () => {
    withAgent();
    const first = await seedPlaybook();
    expect(first.created).toBe(SEED_PLAYBOOK_RULES.length);
    expect(first.updated).toBe(0);
    expect(mockStore.memories).toHaveLength(SEED_PLAYBOOK_RULES.length);

    // Second run updates in place — no duplicate rows.
    const second = await seedPlaybook();
    expect(second.created).toBe(0);
    expect(second.updated).toBe(SEED_PLAYBOOK_RULES.length);
    expect(mockStore.memories).toHaveLength(SEED_PLAYBOOK_RULES.length);
  });

  test("rules come back highest-importance first (bid-strategy leads)", async () => {
    withAgent();
    await seedPlaybook();
    const rules = await getPlaybookRules();
    expect(rules[0].key).toBe("bid-strategy");
    expect(rules[0].importance).toBeGreaterThanOrEqual(0.95);
    // descending importance
    for (let i = 1; i < rules.length; i++) {
      expect(rules[i - 1].importance).toBeGreaterThanOrEqual(rules[i].importance);
    }
  });

  test("seeded rows are durable (no expiry, type long)", async () => {
    withAgent();
    await seedPlaybook();
    for (const m of mockStore.memories) {
      expect(m.expiresAt).toBeNull();
      expect(m.type).toBe("long");
      expect(m.category).toBe("playbook");
    }
  });
});

describe("playbook — prompt rendering", () => {
  test("renders the bid-strategy guardrail and respects max", async () => {
    withAgent();
    await seedPlaybook();
    const block = await renderPlaybookForPrompt({ max: 3 });
    expect(block).toContain("CAMPAIGN PLAYBOOK");
    expect(block).toMatch(/MAXIMIZE_CONVERSIONS/);
    expect(block).toMatch(/NEVER use Manual CPC/i);
    // header (2 lines) + 3 bullets
    expect(block.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
  });

  test("markdown mirror groups by section", async () => {
    withAgent();
    await seedPlaybook();
    const md = await renderPlaybookMarkdown();
    expect(md).toContain("# LockSafe Google Ads — Campaign Playbook (live)");
    expect(md).toContain("## bid-strategy");
    expect(md).toContain("## guardrails");
  });
});

describe("playbook — idempotent upsert", () => {
  test("same key updates rather than duplicates", async () => {
    withAgent();
    const a = await upsertPlaybookRule({ key: "k1", section: "copy", content: "v1", importance: 0.5 });
    expect(a?.created).toBe(true);
    const b = await upsertPlaybookRule({ key: "k1", section: "copy", content: "v2", importance: 0.6 });
    expect(b?.created).toBe(false);
    expect(mockStore.memories).toHaveLength(1);
    const rules = await getPlaybookRules();
    expect(rules[0].content).toBe("v2");
    expect(rules[0].importance).toBeCloseTo(0.6);
  });
});

describe("playbook — self-update from reflection", () => {
  const base = {
    agentName: "ads-specialist",
    subjectType: "draft",
    subjectId: "draft_123",
    subjectLabel: "LockSafe | Bristol | Final",
    metric: "spend_efficiency",
  };

  test("ignores non-ads-specialist / non-campaign / non-win-loss / empty", async () => {
    withAgent();
    await applyReflectionToPlaybook({ ...base, agentName: "cmo", outcome: "WIN", lessons: ["x"] });
    await applyReflectionToPlaybook({ ...base, subjectType: "opportunity", outcome: "WIN", lessons: ["x"] });
    await applyReflectionToPlaybook({ ...base, outcome: "NEUTRAL", lessons: ["x"] });
    await applyReflectionToPlaybook({ ...base, outcome: "WIN", lessons: [] });
    expect(mockStore.memories).toHaveLength(0);
  });

  test("distils a WIN/LOSS into one learned rule, keyed by subject (re-grade updates)", async () => {
    withAgent();
    await applyReflectionToPlaybook({
      ...base,
      outcome: "LOSS",
      lessons: ["Manual CPC wasted spend", "Switch to Maximize Conversions"],
    });
    expect(mockStore.memories).toHaveLength(1);
    let rules = await getPlaybookRules();
    expect(rules[0].section).toBe("learned");
    expect(rules[0].content).toMatch(/LOSS/);
    expect(rules[0].content).toMatch(/Maximize Conversions/);
    expect(rules[0].importance).toBeCloseTo(0.88);

    // Re-grading the SAME subject updates the same row (no growth).
    await applyReflectionToPlaybook({ ...base, outcome: "WIN", lessons: ["Now converting well"] });
    expect(mockStore.memories).toHaveLength(1);
    rules = await getPlaybookRules();
    expect(rules[0].content).toMatch(/WIN/);
    expect(rules[0].importance).toBeCloseTo(0.78);
  });
});
