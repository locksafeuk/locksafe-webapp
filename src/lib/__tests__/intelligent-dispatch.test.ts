/**
 * Real allocation test for the COO dispatch brain.
 *
 * Exercises the ACTUAL scoring/selection code in intelligent-dispatch.ts
 * (findBestLocksmiths + autoDispatchJob) against controlled fixtures. Only the
 * database and external side-effects (SMS, Ollama embed) are mocked, so the
 * distance/rating/availability/coverage logic under test is the real thing.
 *
 * It answers two questions directly:
 *   1. Does the COO allocate jobs to the *right* locksmith?
 *   2. Are unsuitable locksmiths correctly excluded, and is auto-dispatch gated?
 */

import { JobStatus } from "@prisma/client";

// ── Mocks ────────────────────────────────────────────────────────────────────
// In-memory fixtures the prisma mock reads from. Reset per-test.
interface LSFixture {
  id: string;
  name: string;
  companyName: string | null;
  email: string;
  phone: string;
  baseLat: number | null;
  baseLng: number | null;
  coverageRadius: number | null;
  rating: number;
  totalJobs: number;
  isActive: boolean;
  isAvailable: boolean;
  isVerified: boolean;
  defaultAssessmentFee: number | null;
  services: string[];
  jobs: Array<{ status: string }>;       // active jobs (workload)
  applications: Array<{ eta: number }>;  // recent applications (response proxy)
}

const db: {
  job: Record<string, Record<string, unknown>>;
  locksmiths: LSFixture[];
  createdApplications: Array<Record<string, unknown>>;
  existingApplicationKeys: Set<string>;
} = {
  job: {},
  locksmiths: [],
  createdApplications: [],
  existingApplicationKeys: new Set(),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    job: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => db.job[where.id] ?? null),
      findFirst: jest.fn(async () => {
        // oldest pending — not central to these tests
        return Object.values(db.job).find((j) => (j as { status: string }).status === JobStatus.PENDING) ?? null;
      }),
    },
    locksmith: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        // Emulate the real query filter so exclusions are genuinely tested.
        return db.locksmiths.filter((l) => {
          if (where.isActive === true && !l.isActive) return false;
          if (where.isVerified === true && !l.isVerified) return false;
          if (where.baseLat && (l.baseLat === null || l.baseLat === undefined)) return false;
          if (where.baseLng && (l.baseLng === null || l.baseLng === undefined)) return false;
          return true;
        });
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        db.locksmiths.find((l) => l.id === where.id) ?? null,
      ),
    },
    locksmithApplication: {
      findUnique: jest.fn(async ({ where }: { where: { jobId_locksmithId: { jobId: string; locksmithId: string } } }) => {
        const { jobId, locksmithId } = where.jobId_locksmithId;
        return db.existingApplicationKeys.has(`${jobId}:${locksmithId}`)
          ? { id: "existing-app" }
          : null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const rec = { id: `app-${db.createdApplications.length + 1}`, ...data };
        db.createdApplications.push(rec);
        return rec;
      }),
    },
  },
}));

// Disable semantic embed → deterministic distance/rating-driven scoring.
jest.mock("@/lib/llm-router", () => ({
  __esModule: true,
  callOllamaEmbed: jest.fn(async () => {
    throw new Error("embed disabled in test");
  }),
  cosineSimilarity: jest.fn(() => 0.5),
}));

// No real SMS.
jest.mock("@/lib/sms", () => ({
  __esModule: true,
  sendAutoDispatchNotification: jest.fn(async () => ({ success: true })),
  sendSMS: jest.fn(async () => ({ success: true })),
}));

import { findBestLocksmiths, autoDispatchJob } from "@/lib/intelligent-dispatch";

// ── Fixture helpers ──────────────────────────────────────────────────────────
// Central London job location.
const JOB_LAT = 51.5074;
const JOB_LNG = -0.1278;

function makeLocksmith(overrides: Partial<LSFixture> & { id: string }): LSFixture {
  return {
    name: `LS ${overrides.id}`,
    companyName: null,
    email: `${overrides.id}@example.com`,
    phone: "+447700900000",
    baseLat: JOB_LAT,
    baseLng: JOB_LNG,
    coverageRadius: 15,
    rating: 4.5,
    totalJobs: 10,
    isActive: true,
    isAvailable: true,
    isVerified: true,
    defaultAssessmentFee: 49,
    services: ["emergency_lockout"],
    jobs: [],
    applications: [],
    ...overrides,
  };
}

// Offsets in degrees → roughly N miles north (1 deg lat ≈ 69 miles).
function latOffsetForMiles(miles: number): number {
  return miles / 69;
}

function setJob(job: Partial<Record<string, unknown>> & { id: string }) {
  db.job[job.id] = {
    latitude: JOB_LAT,
    longitude: JOB_LNG,
    problemType: "lockout",
    description: "locked out of flat",
    status: JobStatus.PENDING,
    jobNumber: "JOB-1",
    postcode: "EC1A 1BB",
    address: "1 Test St",
    assessmentFee: 49,
    customer: { name: "Test Customer", phone: "+447700900111" },
    ...job,
  };
}

beforeEach(() => {
  db.job = {};
  db.locksmiths = [];
  db.createdApplications = [];
  db.existingApplicationKeys = new Set();
  jest.clearAllMocks();
});

describe("COO allocation — findBestLocksmiths picks the right locksmith", () => {
  it("ranks the nearest qualified locksmith first", async () => {
    setJob({ id: "job1" });
    db.locksmiths = [
      makeLocksmith({ id: "far", baseLat: JOB_LAT + latOffsetForMiles(10) }),   // ~10 mi
      makeLocksmith({ id: "near", baseLat: JOB_LAT + latOffsetForMiles(1) }),   // ~1 mi
      makeLocksmith({ id: "mid", baseLat: JOB_LAT + latOffsetForMiles(4) }),    // ~4 mi
    ];

    const result = await findBestLocksmiths("job1", 5);

    expect(result.success).toBe(true);
    expect(result.topCandidate?.locksmithId).toBe("near");
    // Sorted by score (proximity-dominated here) — near, mid, far.
    expect(result.candidates.map((c) => c.locksmithId)).toEqual(["near", "mid", "far"]);
  });

  it("excludes a locksmith whose own coverage radius doesn't reach the job", async () => {
    setJob({ id: "job2" });
    db.locksmiths = [
      // 12 mi away but only covers 5 mi → must be excluded even though < 15mi cap.
      makeLocksmith({ id: "tight", baseLat: JOB_LAT + latOffsetForMiles(12), coverageRadius: 5 }),
      makeLocksmith({ id: "ok", baseLat: JOB_LAT + latOffsetForMiles(3), coverageRadius: 15 }),
    ];

    const result = await findBestLocksmiths("job2", 5);

    const ids = result.candidates.map((c) => c.locksmithId);
    expect(ids).toContain("ok");
    expect(ids).not.toContain("tight");
  });

  it("excludes locksmiths below the minimum rating (3.5)", async () => {
    setJob({ id: "job3" });
    db.locksmiths = [
      makeLocksmith({ id: "lowrated", rating: 3.0, baseLat: JOB_LAT + latOffsetForMiles(1) }),
      makeLocksmith({ id: "good", rating: 4.6, baseLat: JOB_LAT + latOffsetForMiles(3) }),
    ];

    const result = await findBestLocksmiths("job3", 5);

    const ids = result.candidates.map((c) => c.locksmithId);
    expect(ids).toContain("good");
    expect(ids).not.toContain("lowrated");
  });

  it("excludes inactive and unverified locksmiths (query-level filter)", async () => {
    setJob({ id: "job4" });
    db.locksmiths = [
      makeLocksmith({ id: "inactive", isActive: false, baseLat: JOB_LAT }),
      makeLocksmith({ id: "unverified", isVerified: false, baseLat: JOB_LAT }),
      makeLocksmith({ id: "valid", baseLat: JOB_LAT + latOffsetForMiles(2) }),
    ];

    const result = await findBestLocksmiths("job4", 5);

    expect(result.candidates.map((c) => c.locksmithId)).toEqual(["valid"]);
  });

  it("prefers an available locksmith over an unavailable closer one when scores diverge", async () => {
    setJob({ id: "job5" });
    db.locksmiths = [
      makeLocksmith({ id: "offline_close", isAvailable: false, baseLat: JOB_LAT + latOffsetForMiles(0.5) }),
      makeLocksmith({ id: "online_near", isAvailable: true, baseLat: JOB_LAT + latOffsetForMiles(1.5) }),
    ];

    const result = await findBestLocksmiths("job5", 5);
    // Availability carries 15% weight; the marginally-further available one should win.
    expect(result.topCandidate?.locksmithId).toBe("online_near");
    expect(result.topCandidate?.isAvailable).toBe(true);
  });

  it("returns a clear reason when no locksmiths are in the area", async () => {
    setJob({ id: "job6" });
    db.locksmiths = [
      makeLocksmith({ id: "miles_away", baseLat: JOB_LAT + latOffsetForMiles(40) }),
    ];

    const result = await findBestLocksmiths("job6", 5);
    expect(result.candidates).toHaveLength(0);
    expect(result.reason).toMatch(/no locksmiths/i);
  });
});

describe("COO allocation — auto-dispatch gating", () => {
  it("recommends auto-dispatch for a strong, close, available, fee-set match", async () => {
    setJob({ id: "jobA" });
    db.locksmiths = [
      makeLocksmith({ id: "ideal", baseLat: JOB_LAT + latOffsetForMiles(1), rating: 4.7, defaultAssessmentFee: 49 }),
    ];

    const result = await findBestLocksmiths("jobA", 5);
    expect(result.autoDispatchRecommended).toBe(true);
    expect(result.topCandidate?.matchScore).toBeGreaterThanOrEqual(70);
  });

  it("does NOT auto-dispatch when the best match has no assessment fee set", async () => {
    setJob({ id: "jobB" });
    db.locksmiths = [
      makeLocksmith({ id: "nofee", baseLat: JOB_LAT + latOffsetForMiles(1), rating: 4.7, defaultAssessmentFee: null }),
    ];

    const result = await findBestLocksmiths("jobB", 5);
    expect(result.topCandidate?.locksmithId).toBe("nofee");
    expect(result.autoDispatchRecommended).toBe(false);
  });

  it("does NOT auto-dispatch when the best match is further than 5 miles", async () => {
    setJob({ id: "jobC" });
    db.locksmiths = [
      makeLocksmith({ id: "farish", baseLat: JOB_LAT + latOffsetForMiles(8), rating: 4.7 }),
    ];

    const result = await findBestLocksmiths("jobC", 5);
    expect(result.topCandidate?.distanceMiles).toBeGreaterThan(5);
    expect(result.autoDispatchRecommended).toBe(false);
  });
});

describe("COO allocation — autoDispatchJob side effects & guards", () => {
  it("creates an application for a pending job + verified locksmith", async () => {
    setJob({ id: "jobD", status: JobStatus.PENDING });
    db.locksmiths = [makeLocksmith({ id: "lsD" })];

    const res = await autoDispatchJob("jobD", "lsD", 49, 12);
    expect(res.success).toBe(true);
    expect(res.applicationId).toBeDefined();
    expect(db.createdApplications).toHaveLength(1);
    expect(db.createdApplications[0]).toMatchObject({ jobId: "jobD", locksmithId: "lsD", status: "pending" });
  });

  it("refuses to dispatch a job that is not pending", async () => {
    setJob({ id: "jobE", status: JobStatus.COMPLETED });
    db.locksmiths = [makeLocksmith({ id: "lsE" })];

    const res = await autoDispatchJob("jobE", "lsE", 49, 12);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not pending/i);
    expect(db.createdApplications).toHaveLength(0);
  });

  it("refuses to dispatch to an unverified/inactive locksmith", async () => {
    setJob({ id: "jobF", status: JobStatus.PENDING });
    db.locksmiths = [makeLocksmith({ id: "lsF", isVerified: false })];

    const res = await autoDispatchJob("jobF", "lsF", 49, 12);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not verified|active/i);
  });

  it("does not create a duplicate application", async () => {
    setJob({ id: "jobG", status: JobStatus.PENDING });
    db.locksmiths = [makeLocksmith({ id: "lsG" })];
    db.existingApplicationKeys.add("jobG:lsG");

    const res = await autoDispatchJob("jobG", "lsG", 49, 12);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already applied/i);
    expect(db.createdApplications).toHaveLength(0);
  });
});
