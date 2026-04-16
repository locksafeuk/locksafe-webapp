/**
 * Telegram Bot Webhook Endpoint
 *
 * POST /api/agent/telegram - Receive updates from Telegram
 * GET /api/agent/telegram - Set webhook URL (for setup)
 *
 * This endpoint receives all messages and commands sent to the admin bot
 * and routes them to the appropriate handlers.
 *
 * Supports:
 * - Slash commands (/help, /status, etc.)
 * - Natural language queries ("How many jobs today?", "Show pending jobs", etc.)
 */

import {
  type TelegramUpdate,
  parseCommand,
  verifyTelegramWebhook,
} from "@/lib/agent-auth";
import { handleCallbackQuery, handleCommand } from "@/lib/telegram-bot";
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";
import { type NextRequest, NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Send a message to Telegram chat
 */
async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error("[Telegram] Send message error:", error);
  }
}

/**
 * POST - Receive webhook updates from Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const body: TelegramUpdate = await request.json();

    // Verify the update is from an authorized chat
    const auth = verifyTelegramWebhook(body);

    if (!auth.authenticated) {
      console.log("[Telegram Webhook] Unauthorized:", auth.error, auth.chatId);
      // Return 200 to acknowledge receipt (otherwise Telegram will retry)
      return NextResponse.json({ ok: true });
    }

    const chatId = auth.chatId || "";
    if (!chatId) {
      console.error("[Telegram Webhook] No chatId after auth");
      return NextResponse.json({ ok: true });
    }

    // Handle callback queries (button presses)
    if (body.callback_query) {
      const { id, data } = body.callback_query;
      if (data) {
        await handleCallbackQuery(chatId, id, data);
      }
      return NextResponse.json({ ok: true });
    }

    // Handle text messages
    if (body.message?.text) {
      const text = body.message.text;

      // Check if it's a command (starts with /)
      const parsed = parseCommand(text);

      if (parsed) {
        // Handle slash commands
        await handleCommand(chatId, parsed.command, parsed.args);
      } else if (OPENAI_API_KEY) {
        // Handle natural language queries via OpenAI/OpenClaw
        try {
          console.log(`[Telegram NLP] Processing: "${text}"`);

          const result = await processNaturalLanguageQuery(
            text,
            "admin", // Role - admin for group chat
            undefined, // userId
            undefined // currentJobId
          );

          if (result.response) {
            // Format response with intent info for debugging
            let response = result.response;

            // Add a subtle indicator of what was understood
            if (result.intent && result.intent !== "unknown") {
              response = `${response}\n\n<i>🤖 Understood as: ${result.intent.replace(/_/g, " ")}</i>`;
            }

            await sendTelegramMessage(chatId, response);
          }
        } catch (error) {
          console.error("[Telegram NLP] Error:", error);
          await sendTelegramMessage(
            chatId,
            "❌ Sorry, I couldn't process that query. Try using a command like /help"
          );
        }
      } else {
        // No OpenAI key - suggest using commands
        if (!text.startsWith("/") && text.length > 3) {
          await sendTelegramMessage(
            chatId,
            "💡 I only understand commands right now. Type /help for available commands.\n\n<i>To enable natural language, add OPENAI_API_KEY to your environment.</i>"
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    // Return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

/**
 * GET - Setup webhook or get status
 *
 * Call this endpoint to register the webhook with Telegram.
 * Pass ?setup=true to set the webhook.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const setup = searchParams.get("setup") === "true";
  const webhookUrl = searchParams.get("url");

  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        error: "TELEGRAM_BOT_TOKEN not configured",
      },
      { status: 500 },
    );
  }

  // Get current webhook info
  try {
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`,
    );
    const info = await infoResponse.json();

    if (!setup) {
      return NextResponse.json({
        success: true,
        webhook: info.result,
        instructions: "Pass ?setup=true&url=YOUR_URL to set webhook",
      });
    }

    // Set webhook
    const url =
      webhookUrl ||
      `${process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk"}/api/agent/telegram`;

    const setResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true,
        }),
      },
    );

    const setResult = await setResponse.json();

    if (setResult.ok) {
      return NextResponse.json({
        success: true,
        message: "Webhook set successfully",
        url,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: setResult.description,
      },
      { status: 500 },
    );
  } catch (error) {
    console.error("[Telegram Webhook] Setup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to setup webhook",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE - Remove webhook
 */
export async function DELETE() {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        error: "TELEGRAM_BOT_TOKEN not configured",
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      { method: "POST" },
    );
    const result = await response.json();

    return NextResponse.json({
      success: result.ok,
      message: result.ok ? "Webhook removed" : result.description,
    });
  } catch (error) {
    console.error("[Telegram Webhook] Delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete webhook",
      },
      { status: 500 },
    );
  }
}
