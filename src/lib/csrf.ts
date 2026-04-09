/**
 * CSRF protection utilities.
 * Generates and validates CSRF tokens for form submissions.
 */
import crypto from "crypto";

const CSRF_SECRET = process.env.JWT_SECRET || "locksafe-csrf-fallback-secret";
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a CSRF token.
 * Format: timestamp.signature
 */
export function generateCsrfToken(): string {
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(timestamp)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

/**
 * Validate a CSRF token.
 */
export function validateCsrfToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [timestamp, signature] = parts;
  const ts = parseInt(timestamp, 10);

  // Check expiry
  if (isNaN(ts) || Date.now() - ts > TOKEN_EXPIRY_MS) return false;

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(timestamp)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
}
