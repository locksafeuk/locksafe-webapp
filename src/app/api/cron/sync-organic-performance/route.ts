/**
 * Cron Job: /api/cron/sync-organic-performance
 *
 * Pulls engagement metrics (impressions, reach, likes, comments, shares,
 * saves, clicks) for recently PUBLISHED organic posts from the Meta Graph
 * API and writes them back onto the SocialPost record. Without this, the
 * organic dashboard's performance fields stay at 0 forever and there is no
 * signal to judge which posts/pillars/times actually earn engagement.
 *
 * Strategy:
 *   - Only sync PUBLISHED posts with a Facebook and/or Instagram post ID.
 *   - Only look back POST_LOOKBACK_DAYS (organic engagement matures over days,
 *     and old posts rarely change — no point re-hammering the Graph API).
 *   - Skip posts synced within SYNC_COOLDOWN_MS to avoid redundant calls.
 *   - A post on both FB + IG accumulates metrics across both platforms.
 *
 * Vercel Cron syntax: every 6 hours
 *   0 *\/6 * * *
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { getPostInsights } from "@/lib/social-publisher";
import { isPlatformEnabled } from "@/lib/social-platforms";

/** Only sync posts published within this window (days). */
const POST_LOOKBACK_DAYS = 30;
/** Don't re-sync a post more often than this (ms). */
const SYNC_COOLDOWN_MS = 3 * 60 * 60_000; // 3 hours
/** Max posts to process per run (Graph API courtesy). */
const MAX_POSTS_PER_RUN = 50;

async function verifyAccess(request: NextRequest): Promise<boolean> {
  if (verifyCronAuth(request)) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload && payload.type === "admin") return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const hasAccess = await verifyAccess(request);
  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // Load active Meta accounts. We reuse the exact token fields the publisher
    // uses (pageAccessToken || accessToken for FB; accessToken for IG) so this
    // job authenticates identically to publish-organic.
    const accounts = await prisma.socialAccount.findMany({ where: { isActive: true } });
    type AccountType = typeof accounts[number];
    const facebookAccount  = accounts.find((a: AccountType) => a.platform === "FACEBOOK");
    const instagramAccount = accounts.find((a: AccountType) => a.platform === "INSTAGRAM");

    const fbToken = facebookAccount?.pageAccessToken || facebookAccount?.accessToken;
    // Instagram is currently paused org-wide (see @/lib/social-platforms) —
    // don't spend Graph API calls syncing a platform we aren't posting to.
    const igToken = isPlatformEnabled("INSTAGRAM") ? instagramAccount?.accessToken : undefined;

    if (!fbToken && !igToken) {
      return NextResponse.json({
        success: true,
        message: "No active Meta accounts to sync",
        synced: 0,
      });
    }

    const lookbackStart = new Date(now.getTime() - POST_LOOKBACK_DAYS * 24 * 60 * 60_000);
    const cooldownCutoff = new Date(now.getTime() - SYNC_COOLDOWN_MS);

    // Candidates: published posts with at least one Meta post ID, published
    // recently, not synced too recently. Oldest lastSyncAt first so we always
    // make progress across the backlog.
    const posts = await prisma.socialPost.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { gte: lookbackStart },
        OR: [
          { facebookPostId:  { not: null } },
          { instagramPostId: { not: null } },
        ],
        AND: [
          {
            OR: [
              { lastSyncAt: null },
              { lastSyncAt: { lt: cooldownCutoff } },
            ],
          },
        ],
      },
      orderBy: [{ lastSyncAt: "asc" }],
      take: MAX_POSTS_PER_RUN,
    });

    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No posts due for performance sync",
        synced: 0,
      });
    }

    let synced = 0;
    const errors: string[] = [];

    for (const post of posts) {
      const totals = {
        impressions: 0,
        reach: 0,
        engagement: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
      };
      let gotAny = false;

      // Facebook
      if (post.facebookPostId && fbToken) {
        try {
          const m = await getPostInsights(post.facebookPostId, fbToken, "facebook");
          totals.impressions += m.impressions;
          totals.reach       += m.reach;
          totals.engagement  += m.engagement;
          totals.likes       += m.likes;
          totals.comments    += m.comments;
          totals.shares      += m.shares;
          totals.saves       += m.saves;
          totals.clicks      += m.clicks;
          gotAny = true;
        } catch (err) {
          errors.push(`FB ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Instagram
      if (post.instagramPostId && igToken) {
        try {
          const m = await getPostInsights(post.instagramPostId, igToken, "instagram");
          totals.impressions += m.impressions;
          totals.reach       += m.reach;
          totals.engagement  += m.engagement;
          totals.likes       += m.likes;
          totals.comments    += m.comments;
          totals.shares      += m.shares;
          totals.saves       += m.saves;
          totals.clicks      += m.clicks;
          gotAny = true;
        } catch (err) {
          errors.push(`IG ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (!gotAny) continue;

      // Some Graph metrics (post_engaged_users / engagement) can lag or return
      // 0 while reactions are non-zero — use the larger of the reported
      // engagement and the summed interactions so the dashboard isn't misleading.
      const summedInteractions = totals.likes + totals.comments + totals.shares + totals.saves;
      const engagement = Math.max(totals.engagement, summedInteractions);

      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          impressions: totals.impressions,
          reach:       totals.reach,
          engagement,
          likes:       totals.likes,
          comments:    totals.comments,
          shares:      totals.shares,
          saves:       totals.saves,
          clicks:      totals.clicks,
          lastSyncAt:  new Date(),
        },
      });
      synced++;
    }

    return NextResponse.json({
      success: true,
      message: `Synced performance for ${synced} posts`,
      synced,
      candidates: posts.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in sync-organic-performance cron:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Cron job failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
