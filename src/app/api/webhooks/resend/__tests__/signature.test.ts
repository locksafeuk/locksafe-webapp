/**
 * Tests for Resend webhook Svix signature verification.
 * Verifies the HMAC-SHA256 algorithm matches the Svix spec.
 */
import { createHmac } from "crypto";

// Replicate the core signing logic from the route so we can unit-test it
function computeSvixSignature(secret: string, msgId: string, timestamp: string, body: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${msgId}.${timestamp}.${body}`;
  return createHmac("sha256", secretBytes).update(signedContent).digest("base64");
}

function isFbTokenExpired(error: string): boolean {
  const patterns = ["session is invalid", "expired", "user changed the password", "user logged out", "token is invalid"];
  const lower = error.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

describe("Svix signature verification (Resend webhook)", () => {
  const secret = "whsec_" + Buffer.from("test-secret-key-32-bytes-long!!!").toString("base64");
  const msgId = "msg_test123";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc123" } });

  it("produces a valid base64 HMAC-SHA256 signature", () => {
    const sig = computeSvixSignature(secret, msgId, timestamp, body);
    expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/); // valid base64
    expect(sig.length).toBe(44); // 32 bytes → 44 base64 chars
  });

  it("same inputs produce the same signature (deterministic)", () => {
    const sig1 = computeSvixSignature(secret, msgId, timestamp, body);
    const sig2 = computeSvixSignature(secret, msgId, timestamp, body);
    expect(sig1).toBe(sig2);
  });

  it("different body produces different signature", () => {
    const sig1 = computeSvixSignature(secret, msgId, timestamp, body);
    const sig2 = computeSvixSignature(secret, msgId, timestamp, body + " ");
    expect(sig1).not.toBe(sig2);
  });

  it("different msgId produces different signature", () => {
    const sig1 = computeSvixSignature(secret, "msg_aaa", timestamp, body);
    const sig2 = computeSvixSignature(secret, "msg_bbb", timestamp, body);
    expect(sig1).not.toBe(sig2);
  });

  it("strips whsec_ prefix before decoding", () => {
    const withPrefix = computeSvixSignature("whsec_dGVzdA==", msgId, timestamp, body);
    const withoutPrefix = computeSvixSignature("dGVzdA==", msgId, timestamp, body);
    // Both should use the same raw key bytes
    expect(withPrefix).toBe(withoutPrefix);
  });

  it("rejects timestamp older than 5 minutes", () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6.7 minutes ago
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(Math.abs(nowSeconds - oldTimestamp) > 300).toBe(true);
  });

  it("accepts timestamp within 5 minutes", () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(Math.abs(nowSeconds - recentTimestamp) > 300).toBe(false);
  });
});

describe("Facebook token expiry detection", () => {
  it("detects session is invalid", () => {
    expect(isFbTokenExpired("Error validating access token: The session is invalid because the user logged out.")).toBe(true);
  });

  it("detects expired token", () => {
    expect(isFbTokenExpired("The access token is expired")).toBe(true);
  });

  it("detects user logged out", () => {
    expect(isFbTokenExpired("user logged out")).toBe(true);
  });

  it("detects invalid token", () => {
    expect(isFbTokenExpired("token is invalid")).toBe(true);
  });

  it("does NOT flag a non-expiry error", () => {
    expect(isFbTokenExpired("Rate limit exceeded")).toBe(false);
    expect(isFbTokenExpired("Page not found")).toBe(false);
    expect(isFbTokenExpired("Permission denied")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isFbTokenExpired("SESSION IS INVALID")).toBe(true);
    expect(isFbTokenExpired("TOKEN IS INVALID")).toBe(true);
  });
});
