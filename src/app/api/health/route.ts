/**
 * Public Health Check Endpoint
 *
 * GET /api/health - Returns server status and integration health
 *
 * This endpoint is public (no authentication required) for monitoring.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: "ok" | "error" | "unconfigured"; message?: string }> = {};

  // Check database connection
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    checks.database = { status: "ok" };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }

  // Check Telegram configuration
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const telegramEnabled = process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true";

  if (telegramToken && telegramChatId && telegramEnabled) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${telegramToken}/getMe`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await response.json();
      if (data.ok) {
        checks.telegram = { status: "ok", message: `Bot: @${data.result.username}` };
      } else {
        checks.telegram = { status: "error", message: data.description };
      }
    } catch (error) {
      checks.telegram = {
        status: "error",
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  } else {
    checks.telegram = {
      status: "unconfigured",
      message: "Missing TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, or TELEGRAM_NOTIFICATIONS_ENABLED",
    };
  }

  // Check WhatsApp configuration
  const whatsappPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (whatsappPhoneId && whatsappToken) {
    checks.whatsapp = {
      status: "ok",
      message: "Configured",
    };
  } else {
    checks.whatsapp = {
      status: "unconfigured",
      message: "Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN",
    };
  }

  // Check Stripe configuration
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    checks.stripe = { status: "ok" };
  } else {
    checks.stripe = { status: "unconfigured" };
  }

  // Check OpenAI configuration
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    checks.openai = { status: "ok" };
  } else {
    checks.openai = { status: "unconfigured" };
  }

  // Overall health
  const allOk = Object.values(checks).every(
    (c) => c.status === "ok" || c.status === "unconfigured"
  );

  const criticalOk = checks.database.status === "ok";

  return NextResponse.json({
    status: criticalOk ? (allOk ? "healthy" : "degraded") : "unhealthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV,
    checks,
    webhooks: {
      telegram: "https://locksafe.uk/api/agent/telegram",
      whatsapp: "https://locksafe.uk/api/webhooks/whatsapp",
      stripe: "https://locksafe.uk/api/webhooks/stripe",
    },
  });
}
