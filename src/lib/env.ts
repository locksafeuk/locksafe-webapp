import { z } from "zod";

/**
 * Environment variable validation schema.
 * Validates all required and optional env vars at build/startup time.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL").optional(),

  // Site
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("https://locksafe.uk"),
  NEXT_PUBLIC_SUPPORT_PHONE: z.string().optional(),
  NEXT_PUBLIC_SUPPORT_PHONE_TEL: z.string().optional(),
  NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE: z.string().optional(),
  NEXT_PUBLIC_LOCKSMITH_ADMIN_PHONE_TEL: z.string().optional(),
  NEXT_PUBLIC_LOCKSMITH_ADMIN_WHATSAPP: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").optional(),
  AUTH_RATE_LIMIT_ATTEMPTS: z.string().regex(/^\d+$/).optional(),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.string().regex(/^\d+$/).optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  PAYMENT_MIN_AMOUNT_GBP: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  PAYMENT_MAX_AMOUNT_GBP: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

  // Resend (email)
  RESEND_API_KEY: z.string().optional(),
  RETELL_API_KEY: z.string().startsWith("key_").optional(),
  RETELL_AGENT_ID: z.string().startsWith("agent_").optional(),
  RETELL_PHONE_NUMBER: z.string().startsWith("+").optional(),

  // Google Ads API (CMO autonomous loop — Phase 1: read-only stats only)
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_OAUTH_CLIENT_SECRET: z.string().optional(),
  // MCC / manager account ID (digits only, no dashes). Sent as
  // `login-customer-id` header on every API call when operating on customer
  // accounts beneath an MCC.
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),
  // OAuth callback URL — must exactly match a redirect URI registered in
  // the Google Cloud OAuth consent screen.
  GOOGLE_ADS_OAUTH_REDIRECT_URI: z.string().url().optional(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // Agent Operating System
  AGENTS_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  CRON_SECRET: z.string().optional(),
  FRAUD_CHECK_CUSTOMER_MAX_JOBS_24H: z.string().regex(/^\d+$/).optional(),
  FRAUD_CHECK_DUPLICATE_JOBS_WINDOW_MINUTES: z.string().regex(/^\d+$/).optional(),

  // Telegram notifications
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_IDS: z.string().optional(),
  TELEGRAM_NOTIFICATIONS_ENABLED: z.enum(["true", "false"]).optional(),
  TELEGRAM_TOPIC_NEW_JOBS: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_LOCKSMITHS: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_CUSTOMERS: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_JOB_UPDATES: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_PAYMENTS: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_AGENTS: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_APPLICATIONS: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_QUOTES: z.string().regex(/^\d+$/).optional(),
  TELEGRAM_TOPIC_REVIEWS: z.string().regex(/^\d+$/).optional(),

  // WhatsApp Business API
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Meta (Facebook) Ads + Conversions API
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_AD_ACCOUNT_ID: z.string().optional(),
  META_BUSINESS_ID: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_CONVERSIONS_API_TOKEN: z.string().optional(),
  META_PIXEL_TEST_CODE: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Mapbox
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().startsWith("pk.").optional(),
  MAPBOX_SECRET_TOKEN: z.string().startsWith("sk.").optional(),

  // Local LLM (Ollama) — optional override for self-hosted Hermes endpoint
  OLLAMA_BASE_URL: z.string().url().optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and return typed environment variables.
 * Call this at app startup to catch misconfigurations early.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("\u274c Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);

    // In production, throw to prevent startup with bad config
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment variables. Check server logs for details.");
    }
  }

  return (result.success ? result.data : envSchema.parse({})) as Env;
}

// Export validated env (lazy evaluation)
let _env: Env | null = null;
export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}
