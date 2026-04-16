/**
 * UTM Builder API
 *
 * Generate and manage UTM tracking links
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { addUTMToUrl, buildUTMString } from '@/lib/pixel-events';

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

// GET - List UTM templates
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.uTMTemplate.findMany({
      orderBy: { useCount: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error fetching UTM templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST - Generate UTM links or save template
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action = 'generate' } = body;

    switch (action) {
      case 'generate': {
        const {
          baseUrl,
          source,
          medium,
          campaign,
          content,
          term,
          bulk = false,
          urls = [],
        } = body;

        if (!bulk && !baseUrl) {
          return NextResponse.json({ error: 'Base URL required' }, { status: 400 });
        }

        const utmParams = { source, medium, campaign, content, term };

        if (bulk && urls.length > 0) {
          // Bulk generation
          const results = urls.map((url: string) => ({
            original: url,
            withUTM: addUTMToUrl(url, utmParams),
          }));

          return NextResponse.json({
            success: true,
            action: 'bulk_generate',
            results,
            utmString: buildUTMString(utmParams),
          });
        }

        // Single URL generation
        const fullUrl = addUTMToUrl(baseUrl, utmParams);

        return NextResponse.json({
          success: true,
          action: 'generate',
          original: baseUrl,
          withUTM: fullUrl,
          utmString: buildUTMString(utmParams),
          parameters: utmParams,
        });
      }

      case 'save_template': {
        const { name, description, source, medium, campaign, content, term } = body;

        if (!name || !source || !medium) {
          return NextResponse.json({
            error: 'Name, source, and medium are required'
          }, { status: 400 });
        }

        const template = await prisma.uTMTemplate.create({
          data: {
            name,
            description,
            source,
            medium,
            campaign,
            content,
            term,
          },
        });

        return NextResponse.json({
          success: true,
          action: 'save_template',
          template,
        });
      }

      case 'use_template': {
        const { templateId, baseUrl } = body;

        if (!templateId || !baseUrl) {
          return NextResponse.json({
            error: 'Template ID and base URL required'
          }, { status: 400 });
        }

        const template = await prisma.uTMTemplate.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Increment use count
        await prisma.uTMTemplate.update({
          where: { id: templateId },
          data: { useCount: { increment: 1 } },
        });

        const utmParams = {
          source: template.source,
          medium: template.medium,
          campaign: template.campaign || undefined,
          content: template.content || undefined,
          term: template.term || undefined,
        };

        const fullUrl = addUTMToUrl(baseUrl, utmParams);

        return NextResponse.json({
          success: true,
          action: 'use_template',
          template,
          original: baseUrl,
          withUTM: fullUrl,
          utmString: buildUTMString(utmParams),
        });
      }

      case 'delete_template': {
        const { templateId } = body;

        if (!templateId) {
          return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
        }

        await prisma.uTMTemplate.delete({
          where: { id: templateId },
        });

        return NextResponse.json({
          success: true,
          action: 'delete_template',
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in UTM builder:', error);
    return NextResponse.json({
      error: 'Failed to process UTM request',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
