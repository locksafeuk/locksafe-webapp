/**
 * POST /api/agents/import-campaigns
 *
 * Imports organic social posts from the local `locksafe-social-automation/campaigns/`
 * directory into the MongoDB `SocialPost` table via Prisma.
 *
 * Each campaign folder contains:
 *   posts/facebook.txt, instagram.txt, linkedin.txt, tiktok.txt
 *   campaign_summary.json  (optional — provides topic / hashtags / image prompts)
 *
 * Posts are imported as DRAFT status; admin can review and schedule them.
 * Duplicate campaigns (same folder name) are skipped.
 *
 * Requires admin auth or CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/db';

// ─── Config ──────────────────────────────────────────────────────────────────

const CRON_SECRET = process.env.CRON_SECRET;

// Resolve path to the campaigns directory relative to the project root.
// In production (Vercel) this path won't exist — the route becomes a no-op.
const CAMPAIGNS_DIR = path.resolve(
  process.cwd(),
  '../../locksafe-social-automation/campaigns'
);

const PLATFORM_FILES: Record<string, string> = {
  FACEBOOK:  'facebook.txt',
  INSTAGRAM: 'instagram.txt',
  LINKEDIN:  'linkedin.txt',
  TIKTOK:    'tiktok.txt',
};

// ─── Auth ────────────────────────────────────────────────────────────────────

async function verifyAccess(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return true;

  const token = req.cookies.get('auth_token')?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.type === 'admin') return true;
  }

  if (!CRON_SECRET && process.env.NODE_ENV === 'development') return true;

  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function guessPillarName(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes('fake') || t.includes('rogue') || t.includes('scam') || t.includes('fraud')) return 'anti-fraud';
  if (t.includes('tip') || t.includes('how to') || t.includes('guide') || t.includes('step')) return 'tips';
  if (t.includes('story') || t.includes('case') || t.includes('customer') || t.includes('testimonial')) return 'stories';
  if (t.includes('behind') || t.includes('team') || t.includes('day in')) return 'behind-scenes';
  if (t.includes('stat') || t.includes('%') || t.includes('percent') || t.includes('number')) return 'stats';
  return 'tips'; // default
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[A-Za-z0-9_]+/g) ?? [];
  return [...new Set(matches)];
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const hasAccess = await verifyAccess(req);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!fs.existsSync(CAMPAIGNS_DIR)) {
    return NextResponse.json({
      success: false,
      error: `Campaigns directory not found at: ${CAMPAIGNS_DIR}. This endpoint only works in local development.`,
    }, { status: 404 });
  }

  const campaignFolders = fs
    .readdirSync(CAMPAIGNS_DIR)
    .filter(name => fs.statSync(path.join(CAMPAIGNS_DIR, name)).isDirectory());

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const folder of campaignFolders) {
    const folderPath = path.join(CAMPAIGNS_DIR, folder);

    // Parse topic from folder name (e.g. "20260517_092456_locked_out_at_night_...")
    const rawTopic = folder.replace(/^\d{8}_\d{6}_/, '').replace(/_/g, ' ');

    // Load optional campaign_summary.json
    let summaryJson: Record<string, unknown> = {};
    const summaryPath = path.join(folderPath, 'campaign_summary.json');
    if (fs.existsSync(summaryPath)) {
      try {
        summaryJson = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      } catch {
        // ignore malformed JSON
      }
    }

    const topic: string = (summaryJson.topic as string) ?? rawTopic;
    const pillarName   = guessPillarName(topic);

    // Resolve pillar ID (optional — gracefully skip if not seeded yet)
    const pillar = await prisma.contentPillar.findFirst({ where: { name: pillarName } });

    for (const [platform, filename] of Object.entries(PLATFORM_FILES)) {
      const filePath = path.join(folderPath, 'posts', filename);
      if (!fs.existsSync(filePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8').trim();
      if (!content) continue;

      // Deduplicate: skip if a post with the same source content already exists
      const existingCount = await prisma.socialPost.count({
        where: {
          content: { equals: content },
          platforms: { has: platform as 'FACEBOOK' | 'INSTAGRAM' | 'TWITTER' | 'LINKEDIN' | 'TIKTOK' },
        },
      });

      if (existingCount > 0) {
        skipped++;
        continue;
      }

      const hashtags = extractHashtags(content);

      try {
        await prisma.socialPost.create({
          data: {
            content,
            platforms: [platform as 'FACEBOOK' | 'INSTAGRAM' | 'TWITTER' | 'LINKEDIN' | 'TIKTOK'],
            hashtags,
            status: 'DRAFT',
            aiGenerated: true,
            aiPrompt: `Campaign: ${folder} | Topic: ${topic}`,
            ...(pillar ? { pillarId: pillar.id } : {}),
          },
        });
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${folder}/${filename}: ${msg}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `Import complete: ${imported} posts imported, ${skipped} skipped (duplicates)`,
    imported,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    campaignsScanned: campaignFolders.length,
  });
}

// GET — dry-run preview (count only, no DB writes)
export async function GET(req: NextRequest) {
  const hasAccess = await verifyAccess(req);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!fs.existsSync(CAMPAIGNS_DIR)) {
    return NextResponse.json({
      available: false,
      campaignsDir: CAMPAIGNS_DIR,
      message: 'Campaigns directory not found. Only available in local dev.',
    });
  }

  const campaignFolders = fs
    .readdirSync(CAMPAIGNS_DIR)
    .filter(name => fs.statSync(path.join(CAMPAIGNS_DIR, name)).isDirectory());

  let totalPostFiles = 0;
  for (const folder of campaignFolders) {
    const postsDir = path.join(CAMPAIGNS_DIR, folder, 'posts');
    if (fs.existsSync(postsDir)) {
      totalPostFiles += fs.readdirSync(postsDir).filter(f => f.endsWith('.txt')).length;
    }
  }

  return NextResponse.json({
    available: true,
    campaignsDir: CAMPAIGNS_DIR,
    campaignsFound: campaignFolders.length,
    totalPostFiles,
    hint: 'POST to this endpoint to import posts as DRAFTs',
  });
}
