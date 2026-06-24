import jwt from "jsonwebtoken";
import { TextEncoder } from "node:util";

// jsdom doesn't expose TextEncoder; the Edge runtime does. Polyfill for tests.
if (typeof globalThis.TextEncoder === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).TextEncoder = TextEncoder;
}

// `jose` ships ESM-only (no CJS export) and ts-jest only transforms .ts, so we
// stand in a jsonwebtoken-backed `jwtVerify` that reproduces HS256 semantics
// faithfully: wrong secret / bad signature throws, the algorithm is pinned,
// expiry is enforced, and the decoded payload is returned for the type check.
// This exercises the gate's decision logic; jose↔jsonwebtoken HS256 interop is
// verified separately at runtime/typecheck.
jest.mock("jose", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const jwtLib = require("jsonwebtoken");
  return {
    jwtVerify: async (
      token: string,
      secret: Uint8Array,
      opts: { algorithms?: string[] },
    ) => {
      const secretStr = Buffer.from(secret).toString("utf8");
      const payload = jwtLib.verify(token, secretStr, {
        algorithms: opts?.algorithms,
      });
      return { payload };
    },
  };
});

import { isAuthorizedAdminRequest } from "@/lib/admin-gate";

const SECRET = "test-jwt-secret-admin-gate";
const CRON = "test-cron-secret";
const ADMIN_SECRET = "test-admin-secret";

function sign(payload: object): string {
  return jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: "7d" });
}

const adminToken = () =>
  sign({ id: "a1", email: "a@x.com", name: "A", role: "admin", type: "admin" });
const locksmithToken = () =>
  sign({ id: "l1", email: "l@x.com", name: "L", companyName: null, type: "locksmith" });

describe("isAuthorizedAdminRequest", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.CRON_SECRET = CRON;
    process.env.ADMIN_SECRET = ADMIN_SECRET;
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  const path = "/api/admin/payments";

  it("denies a request with no credentials", async () => {
    expect(await isAuthorizedAdminRequest({ pathname: path })).toBe(false);
  });

  it("allows a valid admin JWT in the cookie", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cookieToken: adminToken() }),
    ).toBe(true);
  });

  it("denies a non-admin (locksmith) JWT in the cookie", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cookieToken: locksmithToken() }),
    ).toBe(false);
  });

  it("denies a tampered/garbage cookie token", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cookieToken: "not.a.jwt" }),
    ).toBe(false);
  });

  it("denies a token signed with the wrong secret", async () => {
    const forged = jwt.sign({ type: "admin" }, "wrong-secret", { algorithm: "HS256" });
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cookieToken: forged }),
    ).toBe(false);
  });

  it("allows an admin JWT in the Authorization: Bearer header", async () => {
    expect(
      await isAuthorizedAdminRequest({
        pathname: path,
        authHeader: `Bearer ${adminToken()}`,
      }),
    ).toBe(true);
  });

  it("allows Bearer <CRON_SECRET> (cron/CLI callers)", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, authHeader: `Bearer ${CRON}` }),
    ).toBe(true);
  });

  it("denies a wrong Bearer secret", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, authHeader: "Bearer nope" }),
    ).toBe(false);
  });

  it("allows the x-vercel-cron internal header", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, isVercelCron: true }),
    ).toBe(true);
  });

  it("allows Bearer <ADMIN_SECRET> (organisations routes)", async () => {
    expect(
      await isAuthorizedAdminRequest({
        pathname: path,
        authHeader: `Bearer ${ADMIN_SECRET}`,
      }),
    ).toBe(true);
  });

  it("allows the x-cron-secret header matching CRON_SECRET (leads/intake)", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cronSecretHeader: CRON }),
    ).toBe(true);
  });

  it("denies a wrong x-cron-secret header", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cronSecretHeader: "nope" }),
    ).toBe(false);
  });

  it("always allows the public tracking-pixel paths (no creds)", async () => {
    expect(
      await isAuthorizedAdminRequest({ pathname: "/api/admin/emails/track" }),
    ).toBe(true);
    expect(
      await isAuthorizedAdminRequest({ pathname: "/api/admin/leads/track" }),
    ).toBe(true);
  });

  it("fails closed when JWT_SECRET is unset, even with an otherwise-valid token", async () => {
    const token = adminToken();
    delete process.env.JWT_SECRET;
    expect(
      await isAuthorizedAdminRequest({ pathname: path, cookieToken: token }),
    ).toBe(false);
  });
});
