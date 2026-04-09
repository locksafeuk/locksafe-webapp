import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",

  // Only enable in production with a valid DSN
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === "production",

  // Performance monitoring
  tracesSampleRate: 0.1,

  // Session replay for debugging
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // Filter out noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error exception captured",
    "Network request failed",
    "Load failed",
  ],

  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],
});
