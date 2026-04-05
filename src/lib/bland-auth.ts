import { NextRequest } from "next/server";
import crypto from "crypto";

/**
 * Bland.ai Webhook Authentication & Verification
 *
 * This module provides security for Bland.ai webhook endpoints.
 * It supports multiple authentication methods:
 *
 * 1. Webhook Secret: A shared secret sent in the X-Bland-Webhook-Secret header
 * 2. Signature Verification: HMAC signature of the request body
 * 3. Request Validation: Basic request structure validation
 *
 * Environment Variables:
 * - BLAND_WEBHOOK_SECRET: Secret key for webhook authentication
 * - BLAND_API_KEY: Bland API key (used for signature verification)
 */

export interface BlandAuthResult {
  isValid: boolean;
  error?: string;
  method?: "webhook_secret" | "signature" | "api_key" | "bypass";
}

// CORS headers for Bland.ai
export const blandCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Bland-Webhook-Secret, X-Bland-Signature, X-Webhook-Secret",
};

/**
 * Verify Bland.ai webhook request authentication
 *
 * Checks multiple authentication methods in order:
 * 1. X-Bland-Webhook-Secret header (recommended for tool calls)
 * 2. X-Webhook-Secret header (alternative header name)
 * 3. Authorization Bearer token
 * 4. HMAC Signature verification
 *
 * If BLAND_WEBHOOK_SECRET is not set, authentication is bypassed (development mode)
 */
export async function verifyBlandWebhook(
  request: NextRequest,
  rawBody?: string
): Promise<BlandAuthResult> {
  const webhookSecret = process.env.BLAND_WEBHOOK_SECRET;
  const blandApiKey = process.env.BLAND_API_KEY;

  // If no webhook secret is configured, log warning and allow (development mode)
  if (!webhookSecret) {
    console.warn(
      "[Bland Auth] ⚠️ BLAND_WEBHOOK_SECRET not configured - authentication bypassed"
    );
    console.warn(
      "[Bland Auth] Set BLAND_WEBHOOK_SECRET in production for security"
    );
    return { isValid: true, method: "bypass" };
  }

  // Method 1: Check X-Bland-Webhook-Secret header
  const blandWebhookSecret = request.headers.get("x-bland-webhook-secret");
  if (blandWebhookSecret) {
    if (blandWebhookSecret === webhookSecret) {
      return { isValid: true, method: "webhook_secret" };
    }
    console.error("[Bland Auth] Invalid X-Bland-Webhook-Secret header");
    return {
      isValid: false,
      error: "Invalid webhook secret",
    };
  }

  // Method 2: Check X-Webhook-Secret header (alternative)
  const webhookSecretHeader = request.headers.get("x-webhook-secret");
  if (webhookSecretHeader) {
    if (webhookSecretHeader === webhookSecret) {
      return { isValid: true, method: "webhook_secret" };
    }
    console.error("[Bland Auth] Invalid X-Webhook-Secret header");
    return {
      isValid: false,
      error: "Invalid webhook secret",
    };
  }

  // Method 3: Check Authorization Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === webhookSecret || token === blandApiKey) {
      return { isValid: true, method: "api_key" };
    }
    console.error("[Bland Auth] Invalid Authorization header");
    return {
      isValid: false,
      error: "Invalid authorization token",
    };
  }

  // Method 4: Check HMAC Signature (X-Bland-Signature header)
  const signature = request.headers.get("x-bland-signature");
  if (signature && rawBody && blandApiKey) {
    const expectedSignature = crypto
      .createHmac("sha256", blandApiKey)
      .update(rawBody)
      .digest("hex");

    const isValidSignature = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (isValidSignature) {
      return { isValid: true, method: "signature" };
    }
    console.error("[Bland Auth] Invalid signature");
    return {
      isValid: false,
      error: "Invalid signature",
    };
  }

  // No authentication method succeeded
  console.error("[Bland Auth] No valid authentication provided");
  console.error("[Bland Auth] Headers received:", {
    "x-bland-webhook-secret": blandWebhookSecret ? "[present]" : "[missing]",
    "x-webhook-secret": webhookSecretHeader ? "[present]" : "[missing]",
    authorization: authHeader ? "[present]" : "[missing]",
    "x-bland-signature": signature ? "[present]" : "[missing]",
  });

  return {
    isValid: false,
    error: "Authentication required. Include X-Bland-Webhook-Secret header.",
  };
}

/**
 * Create an unauthorized response with proper CORS headers
 */
export function unauthorizedResponse(error: string = "Unauthorized") {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      message: "Authentication failed. Please check your webhook configuration.",
    }),
    {
      status: 401,
      headers: {
        ...blandCorsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Validate request body structure for Bland.ai tool calls
 * Returns an object with validation results
 */
export function validateBlandToolRequest(
  body: Record<string, unknown>,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(
    (field) => body[field] === undefined || body[field] === null || body[field] === ""
  );

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Log Bland.ai request for debugging
 */
export function logBlandRequest(
  endpoint: string,
  body: Record<string, unknown>,
  authResult: BlandAuthResult
) {
  const safeBody = { ...body };

  // Redact sensitive fields
  if (safeBody.phone_number) safeBody.phone_number = "***REDACTED***";
  if (safeBody.customer_phone) safeBody.customer_phone = "***REDACTED***";

  console.log(`[Bland.ai] ${endpoint}:`, {
    auth: authResult.method || "none",
    body: safeBody,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Rate limiting for Bland.ai endpoints (simple in-memory implementation)
 * For production, consider using Redis or a dedicated rate limiting service
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.resetTime < now) {
        rateLimitMap.delete(key);
      }
    }
  }

  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

/**
 * Get client IP from request (handles proxies)
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") || // Cloudflare
    "unknown"
  );
}
