interface RecaptchaVerifyOptions {
  token?: string;
  expectedAction?: string;
  minScore?: number;
  remoteIp?: string;
}

interface RecaptchaApiResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
}

export interface RecaptchaVerificationResult {
  success: boolean;
  score: number;
  errorCode?: string;
}

export async function verifyRecaptchaToken(
  options: RecaptchaVerifyOptions,
): Promise<RecaptchaVerificationResult> {
  const secret = process.env.GOOGLE_RECAPTCHA_SECRET_KEY;
  const token = options.token?.trim();

  if (!secret) {
    return { success: true, score: 1 };
  }

  if (!token) {
    return { success: false, score: 0, errorCode: "missing-token" };
  }

  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", token);
  if (options.remoteIp) {
    body.append("remoteip", options.remoteIp);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    return { success: false, score: 0, errorCode: `http-${response.status}` };
  }

  const data = (await response.json()) as RecaptchaApiResponse;
  const score = typeof data.score === "number" ? data.score : 0;
  const minScore = options.minScore ?? 0.5;

  if (!data.success) {
    return {
      success: false,
      score,
      errorCode: data["error-codes"]?.[0] || "verification-failed",
    };
  }

  if (options.expectedAction && data.action && data.action !== options.expectedAction) {
    return { success: false, score, errorCode: "action-mismatch" };
  }

  if (score < minScore) {
    return { success: false, score, errorCode: "low-score" };
  }

  return { success: true, score };
}
