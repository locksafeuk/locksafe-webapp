/**
 * Agent Authentication for OpenClaw Integration
 *
 * Provides secure authentication for AI agent API endpoints.
 * Supports both API key authentication and Telegram webhook verification.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

// Agent API key for OpenClaw
const AGENT_API_KEY = process.env.AGENT_API_KEY;

// Telegram Bot Token for webhook verification
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Telegram Chat IDs allowed for admin operations (comma-separated)
const ADMIN_CHAT_IDS = (
  process.env.TELEGRAM_ADMIN_CHAT_IDS ||
  process.env.TELEGRAM_CHAT_ID ||
  ""
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export interface AgentAuthResult {
  authenticated: boolean;
  type: "api_key" | "telegram" | "internal";
  userId?: string;
  userType?: "admin" | "locksmith" | "customer";
  chatId?: string;
  error?: string;
}

/**
 * Verify API key authentication
 */
export function verifyApiKey(request: NextRequest): AgentAuthResult {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return {
      authenticated: false,
      type: "api_key",
      error: "Missing Authorization header",
    };
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return {
      authenticated: false,
      type: "api_key",
      error: "Invalid Authorization format. Use: Bearer <api_key>",
    };
  }

  if (!AGENT_API_KEY) {
    console.warn("[Agent Auth] AGENT_API_KEY not configured");
    return {
      authenticated: false,
      type: "api_key",
      error: "Agent API not configured",
    };
  }

  if (token !== AGENT_API_KEY) {
    return {
      authenticated: false,
      type: "api_key",
      error: "Invalid API key",
    };
  }

  return {
    authenticated: true,
    type: "api_key",
    userType: "admin", // API key grants admin access
  };
}

/**
 * Verify Telegram webhook request
 * Returns the chat ID and message if valid
 */
export function verifyTelegramWebhook(body: TelegramUpdate): AgentAuthResult {
  // Extract chat ID from the update
  const chatId =
    body.message?.chat?.id?.toString() ||
    body.callback_query?.message?.chat?.id?.toString();

  if (!chatId) {
    return {
      authenticated: false,
      type: "telegram",
      error: "No chat ID in update",
    };
  }

  // Check if chat ID is in admin list
  if (!ADMIN_CHAT_IDS.includes(chatId)) {
    return {
      authenticated: false,
      type: "telegram",
      chatId,
      error: "Unauthorized chat ID",
    };
  }

  return {
    authenticated: true,
    type: "telegram",
    chatId,
    userType: "admin",
  };
}

/**
 * Generate HMAC signature for agent callbacks
 */
export function generateAgentSignature(payload: string): string {
  if (!AGENT_API_KEY) {
    throw new Error("AGENT_API_KEY not configured");
  }

  return crypto
    .createHmac("sha256", AGENT_API_KEY)
    .update(payload)
    .digest("hex");
}

/**
 * Verify agent callback signature
 */
export function verifyAgentSignature(
  payload: string,
  signature: string,
): boolean {
  const expectedSignature = generateAgentSignature(payload);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

// Telegram Update Types
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessageEntity {
  type: "bot_command" | "mention" | "url" | "email" | "text_link" | string;
  offset: number;
  length: number;
  url?: string;
}

/**
 * Parse command from Telegram message
 */
export function parseCommand(
  text: string,
): { command: string; args: string[] } | null {
  if (!text || !text.startsWith("/")) {
    return null;
  }

  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase().replace("@locksafe_admin_bot", ""); // Remove bot mention if present
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Rate limiting for agent requests
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute

export function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);
