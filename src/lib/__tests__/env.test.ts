import { validateEnv } from "../env";

describe("Environment Validation", () => {
  it("should return valid env with defaults", () => {
    const env = validateEnv();
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBeDefined();
  });

  it("should have a default site URL", () => {
    const env = validateEnv();
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://locksafe.co.uk");
  });
});
