/**
 * AI Chat Assistant API
 *
 * Provides conversational AI assistance for ad management
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { chatWithAdAssistant, type ChatMessage } from '@/lib/openai-ads';

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

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, includePerformanceData } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array required' }, { status: 400 });
    }

    // Gather campaign context if requested
    let campaignContext = {};
    let performanceData = {};

    if (includePerformanceData) {
      // Get recent campaigns
      const campaigns = await prisma.adCampaign.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          adSets: {
            include: {
              ads: true,
            },
          },
        },
      });

      campaignContext = {
        totalCampaigns: campaigns.length,
        campaigns: campaigns.map(c => ({
          name: c.name,
          objective: c.objective,
          status: c.status,
          spend: c.totalSpend,
          impressions: c.totalImpressions,
          clicks: c.totalClicks,
          conversions: c.totalConversions,
          revenue: c.totalRevenue,
          roas: c.totalSpend > 0 ? c.totalRevenue / c.totalSpend : 0,
          adCount: c.adSets.reduce((sum, as) => sum + as.ads.length, 0),
        })),
      };

      // Calculate aggregate performance
      const totals = campaigns.reduce(
        (acc, c) => ({
          spend: acc.spend + c.totalSpend,
          impressions: acc.impressions + c.totalImpressions,
          clicks: acc.clicks + c.totalClicks,
          conversions: acc.conversions + c.totalConversions,
          revenue: acc.revenue + c.totalRevenue,
        }),
        { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
      );

      performanceData = {
        totalSpend: totals.spend,
        totalImpressions: totals.impressions,
        totalClicks: totals.clicks,
        totalConversions: totals.conversions,
        totalRevenue: totals.revenue,
        averageCTR: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        averageCPC: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        overallROAS: totals.spend > 0 ? totals.revenue / totals.spend : 0,
      };
    }

    // Call OpenAI
    const response = await chatWithAdAssistant({
      messages: messages as ChatMessage[],
      campaignContext,
      performanceData,
    });

    // Log the interaction
    await prisma.aIGeneration.create({
      data: {
        type: 'chat',
        prompt: messages[messages.length - 1]?.content || '',
        output: { response },
        model: 'gpt-4',
      },
    });

    return NextResponse.json({
      response,
      context: includePerformanceData ? { campaignContext, performanceData } : undefined,
    });
  } catch (error) {
    console.error('Error in AI chat:', error);
    return NextResponse.json({
      error: 'Failed to get AI response',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
