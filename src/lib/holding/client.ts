import type { HoldingMetricsSnapshot } from "./metrics";

export interface HoldingSendResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 25_000;

/**
 * Send the metrics snapshot to the Holding Dashboard.
 * - Reads HOLDING_API_URL / HOLDING_API_TOKEN / HOLDING_METRICS_ENABLED.
 * - Uses Bearer token auth.
 * - Never throws; returns a structured result.
 * - Never logs the token.
 */
export async function sendHoldingMetrics(
  snapshot: HoldingMetricsSnapshot,
): Promise<HoldingSendResult> {
  const enabled = process.env.HOLDING_METRICS_ENABLED === "true";
  if (!enabled) {
    return { success: true, skipped: true, reason: "Holding metrics disabled" };
  }

  const url = process.env.HOLDING_API_URL;
  const token = process.env.HOLDING_API_TOKEN;
  if (!url || !token) {
    return { success: false, error: "Missing Holding configuration" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    });

    if (!res.ok) {
      let snippet = "";
      try {
        snippet = (await res.text()).slice(0, 300);
      } catch {
        // ignore body read errors
      }
      console.error(
        `[holding-client] Holding API responded ${res.status}: ${snippet}`,
      );
      return { success: false, status: res.status, error: "Holding API error" };
    }

    return { success: true, status: res.status };
  } catch (err) {
    const message = (err as Error)?.name === "AbortError"
      ? "Request timed out"
      : (err as Error)?.message || "Unknown network error";
    console.error("[holding-client] send failed:", message);
    return { success: false, error: "Holding API request failed" };
  } finally {
    clearTimeout(timer);
  }
}
