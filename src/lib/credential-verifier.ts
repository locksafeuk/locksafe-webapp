/**
 * AI Credential Verifier
 *
 * Uses the VISION model (qwen2.5-vl:7b) to automatically verify:
 *   - Public Liability Insurance certificates
 *   - DBS (Disclosure and Barring Service) check certificates
 *
 * Confidence thresholds:
 *   ≥ 0.85  → auto-verified, no human needed
 *   0.60–0.84 → pending_review — Telegram alert to admin with AI notes
 *   < 0.60  → unreadable — locksmith asked to re-upload
 *
 * Documents are fetched from their Vercel Blob URLs and converted to base64
 * before being sent to the local Ollama vision model. No document data
 * leaves the self-hosted stack.
 */

import { callOllamaVision } from "@/lib/llm-router";
import { sendAdminAlert } from "@/lib/telegram";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerificationStatus =
  | "verified"
  | "pending_review"
  | "unreadable"
  | "expired"
  | "expiring_soon";

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number; // 0–1
  extractedExpiry: string | null; // ISO date string or null
  notes: string; // plain-English AI summary
  requiresManualReview: boolean;
  autoVerified: boolean; // true if confidence ≥ threshold
  durationMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTO_VERIFY_THRESHOLD = 0.85;
const MANUAL_REVIEW_THRESHOLD = 0.60;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch a document from its URL and return base64-encoded content + MIME type.
 * Supports images (jpg/png/webp) and PDFs converted via the vision model.
 */
async function fetchDocumentAsBase64(
  url: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    // qwen2.5-vl supports: image/jpeg, image/png, image/webp, image/gif
    // PDFs: pass as image/jpeg (Ollama will handle the first page render)
    const mimeType = contentType.startsWith("image/")
      ? contentType.split(";")[0]
      : "image/jpeg";

    return { base64, mimeType };
  } catch {
    return null;
  }
}

/**
 * Parse the structured JSON response from the vision model.
 * Falls back gracefully if the model returns prose instead of JSON.
 */
function parseVisionResponse(raw: string): {
  confidence: number;
  expiryDate: string | null;
  notes: string;
  isValid: boolean;
} {
  // Try to extract JSON block from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        confidence: Number(parsed.confidence ?? 0),
        expiryDate: parsed.expiryDate ?? null,
        notes: String(parsed.notes ?? parsed.summary ?? ""),
        isValid: Boolean(parsed.isValid ?? parsed.valid ?? false),
      };
    } catch {
      // fall through to prose parsing
    }
  }

  // Prose fallback: look for keywords to estimate confidence
  const lower = raw.toLowerCase();
  const isValid =
    lower.includes("valid") ||
    lower.includes("legitimate") ||
    lower.includes("genuine") ||
    lower.includes("verified");
  const isInvalid =
    lower.includes("invalid") ||
    lower.includes("fake") ||
    lower.includes("unclear") ||
    lower.includes("unreadable") ||
    lower.includes("cannot read");

  const confidence = isInvalid ? 0.3 : isValid ? 0.7 : 0.5;

  // Try to extract date in formats: DD/MM/YYYY, YYYY-MM-DD, "Jan 2027", etc.
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{2}\/\d{2}\/\d{4})/,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i,
    /(?:expires?|expiry|valid until|valid to)[\s:]+([^\n.,]+)/i,
  ];

  let expiryDate: string | null = null;
  for (const pattern of datePatterns) {
    const match = raw.match(pattern);
    if (match) {
      const candidate = new Date(match[1]);
      if (!isNaN(candidate.getTime())) {
        expiryDate = candidate.toISOString().split("T")[0];
        break;
      }
    }
  }

  return { confidence, expiryDate, notes: raw.slice(0, 300), isValid };
}

/**
 * Derive final status from confidence + expiry date.
 */
function deriveStatus(
  confidence: number,
  expiryDate: string | null,
  isValid: boolean
): VerificationStatus {
  if (confidence < MANUAL_REVIEW_THRESHOLD || !isValid) return "unreadable";

  // Check expiry if extracted
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    if (expiry < now) return "expired";
    if (expiry <= thirtyDaysFromNow) return "expiring_soon";
  }

  if (confidence >= AUTO_VERIFY_THRESHOLD) return "verified";
  return "pending_review";
}

// ─── Insurance Verification ───────────────────────────────────────────────────

const INSURANCE_PROMPT = `You are verifying a UK Public Liability Insurance certificate for a locksmith platform.

Examine this document image carefully and respond ONLY with a JSON object in this exact format:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "expiryDate": "YYYY-MM-DD or null",
  "notes": "brief plain-English summary of what you see"
}

Assess:
- Is this clearly an insurance certificate or policy document? (not a fake, blank page, or unrelated document)
- Can you read an expiry/renewal date? Extract it in YYYY-MM-DD format.
- Is the document legible and complete (not blurry, cut off, or corrupted)?

confidence: 0.9+ = clearly a valid legible insurance doc with readable expiry
            0.7–0.89 = likely a valid doc but some details unclear
            0.5–0.69 = possibly valid but uncertain (blurry, partial, unusual format)
            below 0.5 = cannot confirm this is a valid insurance certificate`;

export async function verifyInsuranceDocument(
  documentUrl: string,
  locksmithName?: string
): Promise<VerificationResult> {
  const start = Date.now();

  const doc = await fetchDocumentAsBase64(documentUrl);
  if (!doc) {
    return {
      status: "unreadable",
      confidence: 0,
      extractedExpiry: null,
      notes: "Could not download the document from the provided URL.",
      requiresManualReview: true,
      autoVerified: false,
      durationMs: Date.now() - start,
    };
  }

  const { content, durationMs } = await callOllamaVision(
    doc.base64,
    INSURANCE_PROMPT,
    doc.mimeType as "image/jpeg" | "image/png" | "image/webp"
  );

  const parsed = parseVisionResponse(content);
  const status = deriveStatus(parsed.confidence, parsed.expiryDate, parsed.isValid);

  const result: VerificationResult = {
    status,
    confidence: parsed.confidence,
    extractedExpiry: parsed.expiryDate,
    notes: parsed.notes,
    requiresManualReview: status === "pending_review",
    autoVerified: status === "verified",
    durationMs: Date.now() - start,
  };

  // Ping admin via Telegram if manual review needed
  if (status === "pending_review") {
    await sendAdminAlert({
      title: "Insurance Review Required",
      message:
        `Locksmith: ${locksmithName ?? "Unknown"}\n` +
        `AI confidence: ${Math.round(parsed.confidence * 100)}%\n` +
        `Notes: ${parsed.notes}\n\n` +
        `Review at: /admin/locksmiths`,
      severity: "info",
    }).catch(() => {});
  }

  console.log(
    `[CredentialVerifier] Insurance check — status=${status} confidence=${parsed.confidence.toFixed(2)} duration=${durationMs}ms`
  );

  return result;
}

// ─── DBS Verification ─────────────────────────────────────────────────────────

const DBS_PROMPT = `You are verifying a UK DBS (Disclosure and Barring Service) certificate for a locksmith platform.

Examine this document image carefully and respond ONLY with a JSON object in this exact format:
{
  "isValid": true/false,
  "confidence": 0.0-1.0,
  "expiryDate": "YYYY-MM-DD or null",
  "notes": "brief plain-English summary of what you see"
}

Assess:
- Is this clearly a DBS certificate, Enhanced DBS certificate, or DBS Update Service confirmation?
- Can you identify a date of issue? (DBS certs don't have a formal expiry, but the issue date matters — flag if older than 3 years)
- Is the document legible and complete?

For expiryDate: if you can read an issue date, add 3 years to estimate expiry (UK best practice).
If you see a DBS Update Service confirmation, use the subscription renewal date if visible.

confidence: 0.9+ = clearly a valid legible DBS doc
            0.7–0.89 = likely valid but some details unclear
            0.5–0.69 = possibly valid but uncertain
            below 0.5 = cannot confirm this is a valid DBS document`;

export async function verifyDbsDocument(
  documentUrl: string,
  locksmithName?: string
): Promise<VerificationResult> {
  const start = Date.now();

  const doc = await fetchDocumentAsBase64(documentUrl);
  if (!doc) {
    return {
      status: "unreadable",
      confidence: 0,
      extractedExpiry: null,
      notes: "Could not download the document from the provided URL.",
      requiresManualReview: true,
      autoVerified: false,
      durationMs: Date.now() - start,
    };
  }

  const { content, durationMs } = await callOllamaVision(
    doc.base64,
    DBS_PROMPT,
    doc.mimeType as "image/jpeg" | "image/png" | "image/webp"
  );

  const parsed = parseVisionResponse(content);
  const status = deriveStatus(parsed.confidence, parsed.expiryDate, parsed.isValid);

  const result: VerificationResult = {
    status,
    confidence: parsed.confidence,
    extractedExpiry: parsed.expiryDate,
    notes: parsed.notes,
    requiresManualReview: status === "pending_review",
    autoVerified: status === "verified",
    durationMs: Date.now() - start,
  };

  // Ping admin via Telegram if manual review needed
  if (status === "pending_review") {
    await sendAdminAlert({
      title: "DBS Review Required",
      message:
        `Locksmith: ${locksmithName ?? "Unknown"}\n` +
        `AI confidence: ${Math.round(parsed.confidence * 100)}%\n` +
        `Notes: ${parsed.notes}\n\n` +
        `Review at: /admin/locksmiths`,
      severity: "info",
    }).catch(() => {});
  }

  console.log(
    `[CredentialVerifier] DBS check — status=${status} confidence=${parsed.confidence.toFixed(2)} duration=${durationMs}ms`
  );

  return result;
}

// ─── Combined verification check ─────────────────────────────────────────────

/**
 * Returns true if a locksmith meets the minimum credential requirements
 * to be marked isVerified=true and dispatched to jobs.
 *
 * Requirements: insurance verified + DBS verified.
 */
export function isFullyCredentialed(
  insuranceStatus: string,
  dbsStatus: string
): boolean {
  const okStatuses = ["verified", "expiring_soon"]; // expiring_soon still counts
  return okStatuses.includes(insuranceStatus) && okStatuses.includes(dbsStatus);
}

// ─── Profile Photo Face Verification ─────────────────────────────────────────

export interface FaceVerificationResult {
  isRealFace: boolean;
  confidence: number; // 0–1
  notes: string;
  rejectionReason?: string; // Human-readable reason if rejected
  durationMs: number;
}

const FACE_ACCEPT_THRESHOLD = 0.75; // confidence must be ≥ this to accept photo

const FACE_PROMPT = `You are reviewing a locksmith professional profile photo for the LockSafe platform.

Analyse this image and determine if it is a genuine professional headshot/selfie of a real person.

The photo MUST be ACCEPTED if it shows:
- A clear, real human face (headshot or portrait)
- The person is recognisable and presentable
- Reasonable image quality

The photo MUST be REJECTED if it is:
- A company logo or brand image
- A stock photo / advertisement / commercial image
- A cartoon, illustration, or AI-generated face
- A group photo (multiple people)
- A landscape, car, tool, or non-person image
- Deliberately obscured or face not visible
- A scanned ID/document image

Respond ONLY with valid JSON in this exact format:
{
  "isRealFace": true or false,
  "confidence": 0.0 to 1.0,
  "rejectionReason": "brief plain-English reason if rejected, or null if accepted",
  "notes": "one sentence summary"
}`;

/**
 * Verify that a profile photo is a genuine headshot of a real person.
 * Rejects logos, stock images, commercial/advertising imagery, and non-face photos.
 */
export async function verifyProfilePhoto(
  imageUrl: string,
  locksmithName?: string
): Promise<FaceVerificationResult> {
  const start = Date.now();

  const image = await fetchDocumentAsBase64(imageUrl);

  if (!image) {
    return {
      isRealFace: false,
      confidence: 0,
      notes: "Could not fetch image for verification.",
      rejectionReason: "Image could not be retrieved for verification.",
      durationMs: Date.now() - start,
    };
  }

  try {
    const { content, durationMs } = await callOllamaVision(
      image.base64,
      FACE_PROMPT,
      image.mimeType as "image/jpeg" | "image/png" | "image/webp"
    );

    // Parse structured JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const confidence = Math.min(1, Math.max(0, Number(parsed.confidence ?? 0)));
        const isRealFace = Boolean(parsed.isRealFace) && confidence >= FACE_ACCEPT_THRESHOLD;

        const result: FaceVerificationResult = {
          isRealFace,
          confidence,
          notes: String(parsed.notes ?? ""),
          durationMs: Date.now() - start,
        };

        if (!isRealFace) {
          result.rejectionReason =
            parsed.rejectionReason ??
            "Please upload a clear headshot photo of yourself.";
        }

        if (!isRealFace) {
          console.log(
            `[FaceVerifier] Rejected photo for ${locksmithName ?? "unknown"} — confidence=${confidence.toFixed(2)} reason="${result.rejectionReason}"`
          );
          // Optionally alert admin for very suspicious uploads
          if (confidence < 0.3) {
            await sendAdminAlert({
              title: "Suspicious Profile Photo Rejected",
              message:
                `Locksmith: ${locksmithName ?? "Unknown"}\n` +
                `Confidence: ${Math.round(confidence * 100)}%\n` +
                `Reason: ${result.rejectionReason}\n` +
                `Notes: ${result.notes}`,
              severity: "warning",
            }).catch(() => {});
          }
        } else {
          console.log(
            `[FaceVerifier] Accepted photo for ${locksmithName ?? "unknown"} — confidence=${confidence.toFixed(2)}`
          );
        }

        return result;
      } catch {
        // fall through to prose fallback
      }
    }

    // Prose fallback
    const lower = content.toLowerCase();
    const isRealFace =
      lower.includes("real face") ||
      lower.includes("genuine") ||
      lower.includes("headshot") ||
      lower.includes("person");
    const isRejected =
      lower.includes("logo") ||
      lower.includes("stock photo") ||
      lower.includes("advertisement") ||
      lower.includes("not a person") ||
      lower.includes("no face");

    return {
      isRealFace: isRealFace && !isRejected,
      confidence: isRejected ? 0.2 : isRealFace ? 0.65 : 0.5,
      notes: content.slice(0, 200),
      rejectionReason: isRejected
        ? "Please upload a clear headshot photo of yourself."
        : undefined,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    console.error("[FaceVerifier] Vision model error:", error);
    // Fail open — don't block onboarding if AI is unavailable
    return {
      isRealFace: true,
      confidence: 0,
      notes: "Verification service temporarily unavailable.",
      durationMs: Date.now() - start,
    };
  }
}
