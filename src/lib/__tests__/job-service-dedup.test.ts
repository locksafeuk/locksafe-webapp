const mockPrisma = {
  customer: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  job: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockFindNearbyLocksmiths = jest.fn();
const mockNotifyLocksmitheEmergency = jest.fn();
const mockGeocodePostcode = jest.fn();

jest.mock("@/lib/locksmith-matcher", () => ({
  findNearbyLocksmiths: (...args: unknown[]) => mockFindNearbyLocksmiths(...args),
  findNearbyLocksmithsByPostcode: jest.fn(),
  notifyLocksmitheEmergency: (...args: unknown[]) => mockNotifyLocksmitheEmergency(...args),
  geocodePostcode: (...args: unknown[]) => mockGeocodePostcode(...args),
}));

const mockSendSMS = jest.fn();
jest.mock("@/lib/sms", () => ({
  sendSMS: (...args: unknown[]) => mockSendSMS(...args),
}));

const mockGenerateJobNumber = jest.fn();
jest.mock("@/lib/job-number", () => ({
  generateJobNumber: (...args: unknown[]) => mockGenerateJobNumber(...args),
}));

const mockEvaluateEmergencyJobRisk = jest.fn();
const mockGetEmergencyJobRiskConfig = jest.fn();
jest.mock("@/lib/risk-controls", () => ({
  evaluateEmergencyJobRisk: (...args: unknown[]) =>
    mockEvaluateEmergencyJobRisk(...args),
  getEmergencyJobRiskConfig: (...args: unknown[]) =>
    mockGetEmergencyJobRiskConfig(...args),
}));

jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(),
}));

jest.mock("@/lib/stripe", () => ({
  createCheckoutSession: jest.fn(),
}));

import { createEmergencyJob } from "@/lib/job-service";

describe("createEmergencyJob dedup behavior", () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SITE_URL = "https://locksafe.uk";

    mockPrisma.customer.findFirst.mockResolvedValue({
      id: "cust_1",
      name: "John Caller",
      phone: "+447700900123",
      email: "john@example.com",
    });

    mockGetEmergencyJobRiskConfig.mockReturnValue({
      duplicateWindowMinutes: 10,
    });
    mockEvaluateEmergencyJobRisk.mockReturnValue(null);

    mockPrisma.job.count.mockResolvedValue(0);
    mockGeocodePostcode.mockResolvedValue({ latitude: 51.5, longitude: -0.12 });
    mockFindNearbyLocksmiths.mockResolvedValue([]);
    mockNotifyLocksmitheEmergency.mockResolvedValue({
      notifiedCount: 0,
      locksmithIds: [],
    });
    mockGenerateJobNumber.mockResolvedValue("LRS-TEST-0001");
    mockSendSMS.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("reuses a recent same-postcode job and merges only missing fields", async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: "job_existing",
        jobNumber: "LRS-OLD-0001",
        status: "PHONE_INITIATED",
        continueToken: null,
        problemType: "lockout",
        propertyType: "house",
        description: null,
        postcode: "SW1A 1AA",
        address: "10 Downing St",
        emergencyDetails: null,
        exactLocation: null,
        retellCallId: null,
      },
    ]);

    mockPrisma.job.update.mockResolvedValue({ id: "job_existing" });

    const result = await createEmergencyJob({
      customerPhone: "07700 900123",
      customerName: "John Caller",
      customerEmail: "john@example.com",
      postcode: "SW1A 1AA",
      address: "10 Downing St",
      exactLocation: "Blue door",
      problemType: "lockout",
      propertyType: "house",
      emergencyDetails: "Locked out in rain",
      description: "Front door lockout",
      createdVia: "retell_ai",
      retellCallId: "call_123",
    });

    expect(result.success).toBe(true);
    expect(result.job?.id).toBe("job_existing");
    expect(result.dedup?.reusedExistingJob).toBe(true);
    expect(result.dedup?.mergeReason).toBe("same_phone_recent_same_postcode");
    expect(result.dedup?.updatedFields).toEqual(
      expect.arrayContaining([
        "description",
        "emergencyDetails",
        "exactLocation",
        "retellCallId",
        "continueToken",
      ])
    );

    expect(mockPrisma.job.create).not.toHaveBeenCalled();
    expect(mockPrisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job_existing" },
        data: expect.objectContaining({
          description: "Front door lockout",
          emergencyDetails: "Locked out in rain",
          exactLocation: "Blue door",
          retellCallId: "call_123",
          continueToken: expect.any(String),
        }),
      })
    );
    expect(result.job?.continueUrl).toMatch(
      /^https:\/\/locksafe\.uk\/continue-request\//
    );
  });

  it("does not overwrite populated fields on a reused job", async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: "job_existing",
        jobNumber: "LRS-OLD-0002",
        status: "PHONE_INITIATED",
        continueToken: "tok_existing",
        problemType: "lockout",
        propertyType: "house",
        description: "Already complete description",
        postcode: "SW1A 1AA",
        address: "10 Downing St",
        emergencyDetails: "Already detailed",
        exactLocation: "Already set",
        retellCallId: "call_existing",
      },
    ]);

    const result = await createEmergencyJob({
      customerPhone: "07700 900123",
      customerName: "John Caller",
      postcode: "SW1A 1AA",
      address: "10 Downing St",
      exactLocation: "New exact location should not overwrite",
      problemType: "lockout",
      propertyType: "house",
      emergencyDetails: "New details should not overwrite",
      description: "New description should not overwrite",
      createdVia: "retell_ai",
      retellCallId: "call_new",
    });

    expect(result.success).toBe(true);
    expect(result.dedup?.reusedExistingJob).toBe(true);
    expect(result.dedup?.updatedFields).toEqual([]);
    expect(mockPrisma.job.update).not.toHaveBeenCalled();
    expect(result.job?.continueUrl).toBe(
      "https://locksafe.uk/continue-request/tok_existing"
    );
  });

  it("creates a new job when no merge candidate exists", async () => {
    mockPrisma.job.findMany.mockResolvedValue([]);

    mockPrisma.job.create.mockResolvedValue({
      id: "job_new",
      jobNumber: "LRS-TEST-0001",
      status: "PHONE_INITIATED",
    });

    const result = await createEmergencyJob({
      customerPhone: "07700 900123",
      customerName: "John Caller",
      postcode: "EC1A 1BB",
      address: "1 Test Street",
      problemType: "lockout",
      propertyType: "flat",
      description: "Fresh emergency request",
      createdVia: "retell_ai",
      retellCallId: "call_new_job",
    });

    expect(result.success).toBe(true);
    expect(result.dedup?.reusedExistingJob).toBe(false);
    expect(mockPrisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PHONE_INITIATED",
          postcode: "EC1A 1BB",
          customerId: "cust_1",
        }),
      })
    );
    expect(mockSendSMS).toHaveBeenCalled();
  });
});
