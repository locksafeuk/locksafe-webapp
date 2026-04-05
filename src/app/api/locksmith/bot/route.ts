/**
 * Locksmith Personal Bot Webhook Handler
 *
 * Handles Telegram messages for individual locksmith bots
 *
 * POST /api/locksmith/bot - Receive Telegram updates
 * GET /api/locksmith/bot - Get status / setup webhook
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getLocksmithByChatId,
  handleLocksmithCommand,
  handleLocksmithCallback,
  type LocksmithBotContext,
  type LocksmithCommand,
} from "@/lib/locksmith-bot";
import { processNaturalLanguageQuery } from "@/lib/openclaw-nlp";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
    };
    message: {
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

/**
 * GET - Status and webhook setup
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Setup webhook
  if (searchParams.get("setup") === "true") {
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: "Bot token not configured" }, { status: 500 });
    }

    const webhookUrl = `${SITE_URL}/api/locksmith/bot`;

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );

    const result = await response.json();

    return NextResponse.json({
      success: result.ok,
      webhook: webhookUrl,
      result,
    });
  }

  // Get webhook info
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({
      configured: false,
      message: "Telegram bot token not configured",
    });
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
  );

  const info = await response.json();

  return NextResponse.json({
    configured: true,
    webhook: info.result,
  });
}

/**
 * POST - Handle incoming Telegram updates
 */
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    // Handle callback queries (button presses)
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Handle regular messages
    if (update.message?.text) {
      await handleMessage(update.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[LocksmithBot] Webhook error:", error);
    return NextResponse.json({ ok: true }); // Always return 200
  }
}

async function handleMessage(message: TelegramUpdate["message"]) {
  if (!message || !message.text) return;

  const chatId = message.chat.id.toString();
  const text = message.text.trim();

  // Get locksmith by chat ID
  const locksmith = await getLocksmithByChatId(chatId, "telegram");

  // Check if it's a command
  if (text.startsWith("/")) {
    const parts = text.slice(1).split(" ");
    const command = parts[0].toLowerCase() as LocksmithCommand;
    const args = parts.slice(1);

    const ctx: LocksmithBotContext = {
      locksmithId: locksmith?.id || "",
      chatId,
      platform: "telegram",
    };

    const response = await handleLocksmithCommand(ctx, command, args);
    await sendTelegramMessage(chatId, response.text, response.buttons);
    return;
  }

  // Use NLP for natural language queries
  if (locksmith) {
    const nlpResult = await processNaturalLanguageQuery(
      text,
      "locksmith",
      locksmith.id
    );

    await sendTelegramMessage(chatId, nlpResult.response);
    return;
  }

  // Unregistered user
  await sendTelegramMessage(
    chatId,
    "👋 Welcome to LockSafe Locksmith Bot!\n\nTo use this bot, please register your chat in your LockSafe settings.\n\nType /help for more information.",
    [{ text: "Register Account", url: `${SITE_URL}/locksmith/settings` }]
  );
}

async function handleCallback(callback: NonNullable<TelegramUpdate["callback_query"]>) {
  const chatId = callback.message.chat.id.toString();
  const data = callback.data;

  // Answer callback to remove loading state
  await answerCallback(callback.id);

  // Get locksmith
  const locksmith = await getLocksmithByChatId(chatId, "telegram");

  if (!locksmith) {
    await sendTelegramMessage(chatId, "Please register your account first.");
    return;
  }

  const ctx: LocksmithBotContext = {
    locksmithId: locksmith.id,
    chatId,
    platform: "telegram",
  };

  const response = await handleLocksmithCallback(ctx, data);
  await sendTelegramMessage(chatId, response.text, response.buttons);
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  buttons?: Array<{ text: string; callbackData?: string; url?: string }>
) {
  if (!TELEGRAM_BOT_TOKEN) return;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (buttons && buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: buttons.map((btn) => [
        btn.url
          ? { text: btn.text, url: btn.url }
          : { text: btn.text, callback_data: btn.callbackData },
      ]),
    };
  }

  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

async function answerCallback(callbackId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;

  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text,
      }),
    }
  );
}
