/**
 * AI Audience Generation API
 *
 * Generates Facebook ad audience suggestions for LockSafe UK using audience-research
 * principles from Neil Patel (search-intent / data-driven targeting) and Ryan Deiss
 * (Customer Value Journey awareness stages, Before-After-Bridge pain mapping).
 *
 * Replaces the previous hardcoded audience list in the AI Ad Manager wizard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { suggestAudiences } from '@/lib/openai-ads';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== 'admin') return null;
  return payload;
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      goal = 'leads',
      location = 'United Kingdom',
      service,
      serviceName,
      tone,
      additionalContext,
      currentAudiences,
      budget,
    } = body ?? {};

    const audiences = await suggestAudiences({
      goal,
      location,
      service,
      serviceName,
      tone,
      additionalContext,
      currentAudiences,
      budget,
    });

    // Best-effort logging — failures here must not break the response.
    try {
      await prisma.aIGeneration.create({
        data: {
          type: 'audiences_generate',
          prompt: JSON.stringify(body ?? {}),
          output: JSON.parse(JSON.stringify(audiences)),
          tokensUsed: 2000,
          model: 'gpt-4o',
        },
      });
    } catch (logErr) {
      console.warn('Failed to log AI audience generation:', logErr);
    }

    return NextResponse.json({
      success: true,
      audiences,
      count: audiences.length,
    });
  } catch (error) {
    console.error('Error generating audiences:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate audiences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
