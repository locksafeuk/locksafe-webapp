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
    .default("https://locksafe.co.uk"),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters").optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith("sk-").optional(),

  // Resend (email)
  RESEND_API_KEY: z.string().optional(),

  // Retell AI Voice Agent
  RETELL_API_KEY: z.string().startsWith("key_").optional(),

  // Sentry
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Vercel Blob
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

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
