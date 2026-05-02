/**
 * AI Copy Generation API
 *
 * Generates direct-response ad copy using frameworks from:
 * - Neil Patel (data-driven hooks, search-intent matching)
 * - Ryan Deiss  (Before-After-Bridge, PAS + Customer Value Journey)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import {
  generateAdCopy,
  generateCopyWithFramework,
  generatePowerHeadlines,
  generateHooks,
  refreshCreative,
  generateHeadlines,
} from '@/lib/openai-ads';

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

    const body = await request.json();
    const { type = 'generate' } = body;

    let result;
    let tokensUsed = 0;

    switch (type) {
      case 'generate': {
        // Standard generation using all 4 expert frameworks
        const { productDescription, goal, targetAudience, tone, copyStyle, uniqueSellingPoints, service, serviceName } = body;

        // Use LockSafe UK default description if not provided
        const description = productDescription ||
          "LockSafe UK - The UK's first anti-fraud locksmith platform. We connect customers with verified locksmiths, provide GPS tracking, photo documentation, and legal PDF reports for every job. Features: 15-minute average response, automatic refund guarantee, transparent pricing with no hidden fees.";

        result = await generateAdCopy({
          productDescription: description,
          goal: goal || 'leads',
          targetAudience,
          tone,
          copyStyle,
          uniqueSellingPoints,
          service,
          serviceName,
        });

        tokensUsed = 3000; // Increased for richer output
        break;
      }

      case 'framework': {
        // Generate using a specific expert framework
        const { framework, goal, targetAudience, tone } = body;

        const validFrameworks = [
          'neil-patel-data-driven',
          'neil-patel-search-intent',
          'ryan-deiss-bab',
          'ryan-deiss-pas',
          // Legacy aliases — still accepted, mapped server-side to Patel/Deiss equivalents.
          'justin-welsh',
          'russell-brunson',
          'nicholas-cole',
          'simon-sinek',
        ];

        if (!framework || !validFrameworks.includes(framework)) {
          return NextResponse.json({
            error: `Valid framework required (${validFrameworks.join(', ')})`,
          }, { status: 400 });
        }

        result = await generateCopyWithFramework(framework, {
          goal: goal || 'leads',
          targetAudience,
          tone,
        });

        tokensUsed = 2000;
        break;
      }

      case 'power-headlines': {
        // Generate power headlines by angle
        const { angle, count, customContext } = body;

        if (!angle || !['urgency', 'trust', 'control', 'benefit', 'fear', 'curiosity'].includes(angle)) {
          return NextResponse.json({
            error: 'Valid angle required (urgency, trust, control, benefit, fear, curiosity)',
          }, { status: 400 });
        }

        result = await generatePowerHeadlines({
          angle,
          count: count || 5,
          customContext,
        });

        tokensUsed = 500;
        break;
      }

      case 'hooks': {
        // Generate hooks by type
        const { hookType, goal, count } = body;

        if (!hookType || !['pattern-interrupt', 'curiosity-gap', 'story', 'belief', 'problem-agitate'].includes(hookType)) {
          return NextResponse.json({
            error: 'Valid hookType required (pattern-interrupt, curiosity-gap, story, belief, problem-agitate)',
          }, { status: 400 });
        }

        result = await generateHooks({
          type: hookType,
          goal: goal || 'leads',
          count: count || 5,
        });

        tokensUsed = 500;
        break;
      }

      case 'refresh': {
        // Refresh fatigued creative using different frameworks
        const { originalCopy, performance, whatWorked, whatDidntWork, preferredFramework } = body;

        if (!originalCopy) {
          return NextResponse.json({ error: 'Original copy required' }, { status: 400 });
        }

        result = await refreshCreative({
          originalCopy,
          performance: performance || { ctr: 0, conversions: 0, daysRunning: 0 },
          whatWorked,
          whatDidntWork,
          preferredFramework,
        });

        tokensUsed = 2500;
        break;
      }

      case 'headlines': {
        // Legacy headline generation
        const { topic, style, count } = body;

        result = await generateHeadlines({
          topic,
          style: style || 'benefit',
          count: count || 5,
        });

        tokensUsed = 500;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid generation type' }, { status: 400 });
    }

    // Log the generation
    await prisma.aIGeneration.create({
      data: {
        type: `copy_${type}`,
        prompt: JSON.stringify(body),
        output: JSON.parse(JSON.stringify(result)),
        tokensUsed,
        model: 'gpt-4-turbo-preview',
      },
    });

    return NextResponse.json({
      success: true,
      type,
      variations: result,
      tokensUsed,
      frameworks: type === 'generate'
        ? [
            'Neil Patel — Data-Driven Hook',
            'Neil Patel — Search-Intent Promise',
            'Ryan Deiss — Before/After/Bridge',
            'Ryan Deiss — PAS + Customer Value Journey',
          ]
        : undefined,
    });
  } catch (error) {
    console.error('Error generating copy:', error);
    return NextResponse.json({
      error: 'Failed to generate copy',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
