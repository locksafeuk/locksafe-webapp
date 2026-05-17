/**
 * POST /api/agents/seed
 *
 * Seeds / re-initialises all agents in the database.
 * Call this once after deployment or when you need to reset agent state.
 *
 * Requires admin authentication or CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeAgentSystem } from '@/agents';
import prisma from '@/lib/db';

const CRON_SECRET = process.env.CRON_SECRET;
const AGENTS_ENABLED = process.env.AGENTS_ENABLED === 'true';

async function verifyAccess(req: NextRequest): Promise<boolean> {
  // Cron secret
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) return true;

  // Admin session cookie
  const token = req.cookies.get('auth_token')?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.type === 'admin') return true;
  }

  // Allow in dev without any auth
  if (!CRON_SECRET && process.env.NODE_ENV === 'development') return true;

  return false;
}

export async function POST(req: NextRequest) {
  const hasAccess = await verifyAccess(req);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!AGENTS_ENABLED) {
    return NextResponse.json(
      { success: false, message: 'Agents disabled. Set AGENTS_ENABLED=true to enable.' },
      { status: 200 }
    );
  }

  try {
    await initializeAgentSystem();

    const agents = await prisma.agent.findMany({
      select: {
        name: true,
        displayName: true,
        role: true,
        status: true,
        governanceLevel: true,
        monthlyBudgetUsd: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      message: `Seeded ${agents.length} agent(s) successfully`,
      agents,
      seededAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Seed API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Seed failed' },
      { status: 500 }
    );
  }
}

// GET — health check / preview without seeding
export async function GET(req: NextRequest) {
  const hasAccess = await verifyAccess(req);
  if (!hasAccess) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    select: { name: true, displayName: true, status: true, lastHeartbeat: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({
    success: true,
    agentsInDb: agents.length,
    agents,
    agentsEnabled: AGENTS_ENABLED,
    hint: agents.length === 0 ? 'POST to this endpoint to seed agents' : undefined,
  });
}
