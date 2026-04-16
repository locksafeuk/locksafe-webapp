/**
 * AI Copy Generation API
 *
 * Generates powerful ad copy using elite copywriting frameworks from:
 * - Justin Welsh (pattern interrupts, hooks, one-liners)
 * - Russell Brunson (Hook-Story-Offer, Epiphany Bridge)
 * - Nicholas Cole (Category Design, specificity)
 * - Simon Sinek (Start with Why, purpose-driven)
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
        const { productDescription, goal, targetAudience, tone, copyStyle, uniqueSellingPoints } = body;

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
        });

        tokensUsed = 3000; // Increased for richer output
        break;
      }

      case 'framework': {
        // Generate using a specific expert framework
        const { framework, goal, targetAudience, tone } = body;

        if (!framework || !['justin-welsh', 'russell-brunson', 'nicholas-cole', 'simon-sinek'].includes(framework)) {
          return NextResponse.json({
            error: 'Valid framework required (justin-welsh, russell-brunson, nicholas-cole, simon-sinek)',
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
      frameworks: type === 'generate' ? ['Justin Welsh', 'Russell Brunson', 'Nicholas Cole', 'Simon Sinek'] : undefined,
    });
  } catch (error) {
    console.error('Error generating copy:', error);
    return NextResponse.json({
      error: 'Failed to generate copy',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
