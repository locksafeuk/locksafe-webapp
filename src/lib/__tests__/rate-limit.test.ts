import { checkRateLimit } from "../rate-limit";

describe("Rate Limiter", () => {
  it("should allow requests within limit", () => {
    const result = checkRateLimit("test-ip-1", {
      maxRequests: 5,
      windowSeconds: 60,
    });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("should block requests over limit", () => {
    const config = { maxRequests: 3, windowSeconds: 60 };
    const ip = "test-ip-block";

    checkRateLimit(ip, config);
    checkRateLimit(ip, config);
    checkRateLimit(ip, config);

    const result = checkRateLimit(ip, config);
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should track remaining requests correctly", () => {
    const config = { maxRequests: 5, windowSeconds: 60 };
    const ip = "test-ip-remaining";

    const r1 = checkRateLimit(ip, config);
    expect(r1.remaining).toBe(4);

    const r2 = checkRateLimit(ip, config);
    expect(r2.remaining).toBe(3);
  });
});
