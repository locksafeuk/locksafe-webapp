const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockUpdate = jest.fn();

class MockResponse {
  status: number;
  private body: unknown;

  constructor(body: unknown, status = 200) {
    this.body = body;
    this.status = status;
  }

  async json() {
    return this.body;
  }
}

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => new MockResponse(body, init?.status ?? 200),
  },
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    voiceAgentConfigVersion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  isAdminAuthenticated: jest.fn(() => Promise.resolve({ email: "admin@locksafe.uk" })),
}));

let POST: (req: any) => Promise<any>;
let PATCH: (req: any) => Promise<any>;

beforeAll(async () => {
  const mod = await import("../deploy/route");
  POST = mod.POST;
  PATCH = mod.PATCH;
});

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdateMany.mockReset();
  mockUpdate.mockReset();
});

function makeRequest(body: unknown) {
  return {
    json: async () => body,
  };
}

describe("POST /api/retell/config/versions/deploy", () => {
  it("deploys a version and undeploys others", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "ver123",
      configId: "cfg123",
      isDeployed: false,
      deployedAt: null,
      deployedBy: null,
    });
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockUpdate.mockResolvedValueOnce({
      id: "ver123",
      configId: "cfg123",
      isDeployed: true,
      deployedAt: new Date("2026-05-19T12:00:00.000Z"),
      deployedBy: "admin@locksafe.uk",
    });

    const response = await POST(makeRequest({ versionId: "ver123" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.deployed.isDeployed).toBe(true);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { configId: "cfg123", isDeployed: true },
      data: { isDeployed: false, deployedAt: null, deployedBy: null },
    });
  });
});

describe("PATCH /api/retell/config/versions/rollback", () => {
  it("rolls back a deployed version", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "ver123",
      configId: "cfg123",
      isDeployed: true,
      deployedAt: new Date("2026-05-19T12:00:00.000Z"),
      deployedBy: "admin@locksafe.uk",
    });
    mockUpdate.mockResolvedValueOnce({
      id: "ver123",
      configId: "cfg123",
      isDeployed: false,
      deployedAt: null,
      deployedBy: null,
    });

    const response = await PATCH(makeRequest({ versionId: "ver123" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.rolledBack.isDeployed).toBe(false);
  });
});
