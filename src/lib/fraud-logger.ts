import { sendAdminAlert } from "@/lib/telegram";

export type FraudCategory =
  | "click_fraud"
  | "fake_lead"
  | "fake_call"
  | "fake_job"
  | "api_abuse"
  | "webhook_abuse";

export type FraudSeverity = "info" | "warn" | "critical";

interface FraudLogPayload {
  category: FraudCategory;
  event: string;
  severity?: FraudSeverity;
  ip?: string;
  userId?: string;
  token?: string;
  phone?: string;
  email?: string;
  details?: Record<string, unknown>;
}

const alertCooldownStore = new Map<string, number>();

function maskPhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const compact = phone.replace(/\s+/g, "");
  if (compact.length <= 4) return compact;
  return `${"*".repeat(compact.length - 4)}${compact.slice(-4)}`;
}

function maskEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (!local || local.length < 2) return `*@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

function shouldSendAlert(key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const lastSent = alertCooldownStore.get(key) || 0;
  if (now - lastSent < cooldownMs) {
    return false;
  }
  alertCooldownStore.set(key, now);
  return true;
}

export async function logSuspiciousActivity(payload: FraudLogPayload): Promise<void> {
  const severity = payload.severity || "warn";
  const ip = payload.ip || "unknown";

  console.warn("[FraudGuard] Suspicious activity", {
    category: payload.category,
    event: payload.event,
    severity,
    ip,
    userId: payload.userId,
    token: payload.token,
    phone: maskPhone(payload.phone),
    email: maskEmail(payload.email),
    details: payload.details || {},
  });

  const enabled = process.env.FRAUD_ALERTS_TELEGRAM_ENABLED === "true";
  if (!enabled) {
    return;
  }

  const cooldownMs = Math.max(
    30_000,
    Number.parseInt(process.env.FRAUD_ALERTS_COOLDOWN_MS || "120000", 10) || 120_000,
  );

  const alertKey = `${payload.category}:${payload.event}:${ip}`;
  if (!shouldSendAlert(alertKey, cooldownMs)) {
    return;
  }

  const message = [
    `Event: ${payload.event}`,
    `Category: ${payload.category}`,
    `IP: ${ip}`,
    payload.userId ? `User: ${payload.userId}` : null,
    payload.phone ? `Phone: ${maskPhone(payload.phone)}` : null,
    payload.email ? `Email: ${maskEmail(payload.email)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await sendAdminAlert({
    title: "FraudGuard alert",
    message,
    severity:
      severity === "critical"
        ? "error"
        : severity === "warn"
          ? "warning"
          : "info",
    bypassPolicyGate: true,
  }).catch((error) => {
    console.warn("[FraudGuard] Failed to send alert", error);
  });
}
