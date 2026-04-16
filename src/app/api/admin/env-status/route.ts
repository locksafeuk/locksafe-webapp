/**
 * Environment Variables Status API
 *
 * Returns which required environment variables are configured
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'admin') {
    return null;
  }

  return payload;
}

export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Meta Ads environment variables
    const metaVars = {
      META_APP_ID: !!process.env.META_APP_ID,
      META_APP_SECRET: !!process.env.META_APP_SECRET,
      META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN,
      META_AD_ACCOUNT_ID: !!process.env.META_AD_ACCOUNT_ID,
      META_PAGE_ID: !!process.env.META_PAGE_ID,
      NEXT_PUBLIC_META_PIXEL_ID: !!process.env.NEXT_PUBLIC_META_PIXEL_ID,
      META_CONVERSIONS_API_TOKEN: !!process.env.META_CONVERSIONS_API_TOKEN,
    };

    // Check OpenAI environment variables
    const openaiVars = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    };

    // Check Telegram environment variables
    const telegramVars = {
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: !!process.env.TELEGRAM_CHAT_ID,
      TELEGRAM_NOTIFICATIONS_ENABLED: process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true",
    };

    // Check WhatsApp environment variables
    const whatsappVars = {
      WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_ACCESS_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_VERIFY_TOKEN: !!process.env.WHATSAPP_VERIFY_TOKEN,
      WHATSAPP_BUSINESS_ACCOUNT_ID: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };

    // Check other ad platform variables
    const otherVars = {
      NEXT_PUBLIC_GOOGLE_ADS_ID: !!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
      NEXT_PUBLIC_BING_UET_TAG_ID: !!process.env.NEXT_PUBLIC_BING_UET_TAG_ID,
      NEXT_PUBLIC_TIKTOK_PIXEL_ID: !!process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
    };

    // Calculate Telegram status
    const telegramConfigured = Object.values(telegramVars).filter(Boolean).length;
    const telegramTotal = Object.keys(telegramVars).length;
    const telegramReady = telegramVars.TELEGRAM_BOT_TOKEN && telegramVars.TELEGRAM_CHAT_ID && telegramVars.TELEGRAM_NOTIFICATIONS_ENABLED;

    // Calculate WhatsApp status
    const whatsappConfigured = Object.values(whatsappVars).filter(Boolean).length;
    const whatsappTotal = Object.keys(whatsappVars).length;
    const whatsappReady = whatsappVars.WHATSAPP_PHONE_NUMBER_ID && whatsappVars.WHATSAPP_ACCESS_TOKEN;

    // Calculate totals
    const metaConfigured = Object.values(metaVars).filter(Boolean).length;
    const metaTotal = Object.keys(metaVars).length;
    const openaiConfigured = Object.values(openaiVars).filter(Boolean).length;
    const openaiTotal = Object.keys(openaiVars).length;

    // Determine overall status
    const metaReady = metaVars.META_ACCESS_TOKEN && metaVars.META_AD_ACCOUNT_ID && metaVars.META_PAGE_ID;
    const aiReady = openaiVars.OPENAI_API_KEY;

    return NextResponse.json({
      telegram: {
        variables: telegramVars,
        configured: telegramConfigured,
        total: telegramTotal,
        ready: telegramReady,
        webhookUrl: "https://locksafe.uk/api/agent/telegram",
      },
      whatsapp: {
        variables: whatsappVars,
        configured: whatsappConfigured,
        total: whatsappTotal,
        ready: whatsappReady,
        webhookUrl: "https://locksafe.uk/api/webhooks/whatsapp",
      },
      meta: {
        variables: metaVars,
        configured: metaConfigured,
        total: metaTotal,
        ready: metaReady,
      },
      openai: {
        variables: openaiVars,
        configured: openaiConfigured,
        total: openaiTotal,
        ready: aiReady,
      },
      other: {
        variables: otherVars,
      },
      summary: {
        telegramReady,
        whatsappReady,
        canPublishToMeta: metaReady,
        canUseAI: aiReady,
        allConfigured: metaConfigured === metaTotal && openaiConfigured === openaiTotal && telegramReady && whatsappReady,
      },
    });
  } catch (error) {
    console.error('Error checking env status:', error);
    return NextResponse.json({ error: 'Failed to check environment status' }, { status: 500 });
  }
}
