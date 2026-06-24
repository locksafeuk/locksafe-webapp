/**
 * Cron Job: /api/cron/publish-organic
 *
 * Auto-publishes scheduled organic posts when their scheduled time arrives.
 * Should run every 5-15 minutes.
 *
 * Vercel Cron syntax: Run every 5 minutes
 * 0/5 * * * *
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { TwitterApi } from "twitter-api-v2";
import { SocialPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  publishToFacebook,
  publishToInstagram,
} from "@/lib/social-publisher";
import { formatPostForPlatform } from "@/lib/organic-content";
import { isTwitterConfigured, postTweet, postThread, postTweetWithImage } from "@/lib/twitter";
import { isLinkedInConfigured, postToLinkedIn } from "@/lib/linkedin";
import { isTikTokApiConfigured, generateTikTokScript, postPhotoToTikTok, postVideoToTikTok } from "@/lib/tiktok";
import { sendAdminAlert } from "@/lib/telegram";
import { isPlatformEnabled } from "@/lib/social-platforms";

/** Facebook errors that indicate a permanently invalid token (not transient) */
const FB_TOKEN_EXPIRED_ERRORS = [
  "session is invalid",
  "expired",
  "user changed the password",
  "user logged out",
  "token is invalid",
];

function isFbTokenExpired(error: string): boolean {
  const lower = error.toLowerCase();
  return FB_TOKEN_EXPIRED_ERRORS.some((pattern) => lower.includes(pattern));
}

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
  // Verify this is a legitimate cron call or admin request
  const hasAccess = await verifyAccess(request);
  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // Get social accounts first so we can avoid queue starvation: if the
    // oldest scheduled posts target only inactive platforms, repeatedly
    // picking them blocks publishable posts behind them forever.
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
    });

    type AccountType = typeof accounts[number];
    const facebookAccount  = accounts.find((a: AccountType) => a.platform === "FACEBOOK");
    const instagramAccount = accounts.find((a: AccountType) => a.platform === "INSTAGRAM");
    // Twitter: prefer DB credentials, fall back to env vars
    const twitterDbAccount = accounts.find((a: AccountType) => a.platform === "TWITTER");
    // Prefer OAuth 1.0a env vars (permanent, never expire) over DB OAuth 2.0 token (expires every 2h)
    const twitterEnabled   = !!(isTwitterConfigured() || twitterDbAccount);
    // LinkedIn: prefer DB credentials, fall back to env vars
    const linkedinDbAccount = accounts.find((a: AccountType) => a.platform === "LINKEDIN");
    const linkedinEnabled  = !!(linkedinDbAccount || isLinkedInConfigured());
    const tiktokDbAccount  = accounts.find((a: AccountType) => a.platform === "TIKTOK");
    const tiktokApiEnabled = isTikTokApiConfigured();

    const publishablePlatforms: SocialPlatform[] = [];
    if (facebookAccount) publishablePlatforms.push(SocialPlatform.FACEBOOK);
    // Instagram is currently paused org-wide (see @/lib/social-platforms).
    if (instagramAccount && isPlatformEnabled(SocialPlatform.INSTAGRAM)) {
      publishablePlatforms.push(SocialPlatform.INSTAGRAM);
    }
    if (twitterEnabled) publishablePlatforms.push(SocialPlatform.TWITTER);
    if (linkedinEnabled) publishablePlatforms.push(SocialPlatform.LINKEDIN);
    // TikTok posts are considered publishable because we can at least generate
    // script output even without direct API posting configured.
    publishablePlatforms.push(SocialPlatform.TIKTOK);

    // Reset any posts stuck in PUBLISHING for >10 minutes (from a previous crashed run)
    const staleThreshold = new Date(now.getTime() - 10 * 60_000);
    await prisma.socialPost.updateMany({
      where: { status: "PUBLISHING", updatedAt: { lt: staleThreshold } },
      data: { status: "SCHEDULED", publishError: null },
    });

    // ── Daily posting cap ──────────────────────────────────────────────
    // Hard limit on how many posts publish per day, so a big batch of approved
    // backgrounds (or a few skipped days) can never flood the feed. Default 1;
    // override with LOCKSAFE_DAILY_POST_CAP.
    const DAILY_POST_CAP = Number(process.env.LOCKSAFE_DAILY_POST_CAP) > 0
      ? Number(process.env.LOCKSAFE_DAILY_POST_CAP)
      : 1;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const publishedToday = await prisma.socialPost.count({
      where: { status: "PUBLISHED", publishedAt: { gte: startOfDay } },
    });
    const remaining = DAILY_POST_CAP - publishedToday;
    if (remaining <= 0) {
      return NextResponse.json({
        success: true,
        message: `Daily posting cap reached (${publishedToday}/${DAILY_POST_CAP}) — skipping`,
        processed: 0,
      });
    }

    // Find posts that are scheduled and ready to publish.
    // Must have SOME media (a poster image OR a video) — never publish media-less.
    // NB: `imageUrl: { not: null }` alone (a) can miss never-set rows on MongoDB and
    // (b) wrongly excludes video-only posts; the OR here + the per-branch media
    // guards below fix both.
    const postsToPublish = await prisma.socialPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: now,
        },
        platforms: {
          hasSome: publishablePlatforms,
        },
        OR: [
          { imageUrl: { not: null } },
          { videoUrl: { not: null } },
        ],
      },
      include: {
        pillar: true,
      },
      take: remaining, // Daily cap: only publish up to the remaining daily allowance
    });

    if (postsToPublish.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No posts to publish",
        processed: 0,
      });
    }

    const results: Array<{
      postId: string;
      success: boolean;
      platforms: {
        facebook?: { success: boolean; postId?: string; error?: string };
        instagram?: { success: boolean; postId?: string; error?: string };
      };
    }> = [];

    for (const post of postsToPublish) {
      // Update status to publishing
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHING" },
      });

      const platformResults: {
        facebook?:  { success: boolean; postId?: string; error?: string };
        instagram?: { success: boolean; postId?: string; error?: string };
        twitter?:   { success: boolean; postId?: string; error?: string };
        linkedin?:  { success: boolean; postId?: string; error?: string };
        tiktok?:    { success: boolean; postId?: string; script?: string; error?: string };
      } = {};

      // Publish to Facebook if platform is selected AND we have media (poster or
      // video). The hard media guard (matching the Instagram branch) guarantees we
      // NEVER publish a text-only Facebook post, even if a media-less row slips the
      // query filter.
      if (post.platforms.includes("FACEBOOK") && facebookAccount && (post.imageUrl || post.videoUrl)) {
        const fbContent = formatPostForPlatform(
          {
            content: post.content,
            headline: post.headline || "",
            hook: post.hook || "",
            hookType: post.hookType || "",
            hashtags: post.hashtags,
            framework: post.aiFramework || "",
            emotionalAngle: post.emotionalAngle || "",
            pillar: (post.pillar?.name as 'anti-fraud' | 'tips' | 'stories' | 'behind-scenes' | 'stats' | 'engagement') || "tips",
            reasoning: "",
          },
          "facebook"
        );

        const fbResult = await publishToFacebook({
          pageId: facebookAccount.pageId || facebookAccount.accountId,
          pageAccessToken: facebookAccount.pageAccessToken || facebookAccount.accessToken,
          message: fbContent,
          // Posters only on Facebook for now (videos paused — see generate-post-videos).
          imageUrl: post.imageUrl || undefined,
        });

        platformResults.facebook = {
          success: fbResult.success,
          postId: fbResult.postId,
          error: fbResult.error,
        };

        // If the token is permanently invalid, deactivate the account and alert admin
        if (!fbResult.success && fbResult.error && isFbTokenExpired(fbResult.error)) {
          await prisma.socialAccount.update({
            where: { id: facebookAccount.id },
            data: { isActive: false },
          });
          await sendAdminAlert({
            title: "⚠️ Facebook Token Expired",
            message: `Facebook Page Access Token has expired and publishing has stopped.\n\nError: ${fbResult.error}\n\nTo fix:\n1. Get a new Page Access Token from Facebook Developer Console\n2. Run: FACEBOOK_PAGE_ACCESS_TOKEN=<token> npx ts-node -P tsconfig.scripts.json scripts/refresh-facebook-token.ts`,
            severity: "error",
          });
          // Reset this post back to SCHEDULED (not FAILED) so it retries after token refresh
          await prisma.socialPost.update({
            where: { id: post.id },
            data: { status: "SCHEDULED", publishError: "Facebook token expired — account deactivated pending refresh" },
          });
          // Also reset remaining batch back to SCHEDULED
          results.push({ postId: post.id, success: false, platforms: platformResults });
          break; // Stop processing — token is dead for all remaining posts
        }
      }

      // Publish to Instagram if platform is selected, enabled, and has media
      // (a Reel video or an image).
      if (post.platforms.includes("INSTAGRAM") && isPlatformEnabled("INSTAGRAM") && instagramAccount && (post.imageUrl || post.videoUrl)) {
        const igContent = formatPostForPlatform(
          {
            content: post.content,
            headline: post.headline || "",
            hook: post.hook || "",
            hookType: post.hookType || "",
            hashtags: post.hashtags,
            framework: post.aiFramework || "",
            emotionalAngle: post.emotionalAngle || "",
            pillar: (post.pillar?.name as 'anti-fraud' | 'tips' | 'stories' | 'behind-scenes' | 'stats' | 'engagement') || "tips",
            reasoning: "",
          },
          "instagram"
        );

        const igResult = await publishToInstagram({
          instagramAccountId: instagramAccount.accountId,
          accessToken: instagramAccount.accessToken,
          caption: igContent,
          // Reel when we have a short; else the poster image / carousel.
          videoUrl: post.videoUrl || undefined,
          imageUrl: post.imageUrl || "",
          carouselItems: !post.videoUrl && post.carouselImages.length > 0 ? post.carouselImages : undefined,
        });

        platformResults.instagram = {
          success: igResult.success,
          postId: igResult.postId,
          error: igResult.error,
        };
      }

      // Publish to Twitter/X
      if (post.platforms.includes("TWITTER") && twitterEnabled) {
        try {
          const tweetText = (post as Record<string, unknown>).twitterContent as string | undefined || post.content;
          const threadParts = (post as Record<string, unknown>).twitterThreadParts as string[] | undefined;

          // Prefer OAuth 1.0a env vars (permanent, never expire) over DB OAuth 2.0 token (expires every 2h)
          if (isTwitterConfigured()) {
            if (post.imageUrl) {
              const imageResponse = await fetch(post.imageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch Twitter image: ${imageResponse.status}`);
              }
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const result = await postTweetWithImage(tweetText.slice(0, 280), imageBuffer, "image/png");
              platformResults.twitter = { success: true, postId: result.id };
            } else if (threadParts && threadParts.length > 1) {
              const result = await postThread(threadParts);
              platformResults.twitter = { success: true, postId: result.ids[0] };
            } else {
              const result = await postTweet(tweetText.slice(0, 280));
              platformResults.twitter = { success: true, postId: result.id };
            }
          } else if (twitterDbAccount) {
            // Fallback: OAuth 2.0 DB token (may expire — reconnect via /admin/social-connect)
            const twitterClient = new TwitterApi(twitterDbAccount.accessToken);
            if (post.imageUrl) {
              const imageResponse = await fetch(post.imageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch Twitter image: ${imageResponse.status}`);
              }
                const imageMimeType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/png";
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: imageMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp" });
              const { data } = await twitterClient.v2.tweet({
                text: tweetText.slice(0, 280),
                media: { media_ids: [mediaId] },
              });
              platformResults.twitter = { success: true, postId: data.id };
            } else if (threadParts && threadParts.length > 1) {
              const tweets = await twitterClient.v2.tweetThread(threadParts);
              platformResults.twitter = { success: true, postId: tweets[0]?.data?.id };
            } else {
              const { data } = await twitterClient.v2.tweet(tweetText.slice(0, 280));
              platformResults.twitter = { success: true, postId: data.id };
            }
          }
        } catch (err) {
          platformResults.twitter = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      // Publish to LinkedIn
      if (post.platforms.includes("LINKEDIN") && linkedinEnabled) {
        try {
          const linkedinText = (post as Record<string, unknown>).linkedinContent as string | undefined || post.content;
          // Use DB account if available (from OAuth connect), else fall back to env vars
          if (linkedinDbAccount) {
            const accountId = linkedinDbAccount.accountId;
            const token  = linkedinDbAccount.accessToken;
            const orgId = accountId.startsWith("urn:li:") ? accountId.split(":").pop() ?? accountId : accountId;
            const result = await postToLinkedIn(
              { text: linkedinText, imageUrl: post.imageUrl ?? undefined },
              { token, orgId, authorUrn: accountId.startsWith("urn:li:") ? accountId : `urn:li:organization:${accountId}` }
            );
            platformResults.linkedin = { success: true, postId: result.id };
          } else {
            const result = await postToLinkedIn({ text: linkedinText, imageUrl: post.imageUrl ?? undefined });
            platformResults.linkedin = { success: true, postId: result.id };
          }
        } catch (err) {
          platformResults.linkedin = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      // TikTok: real PHOTO post when a connected account + image exist; else
      // fall back to generating a script for manual/AI video production.
      if (post.platforms.includes("TIKTOK")) {
        const caption = (post as Record<string, unknown>).tiktokContent as string | undefined || post.content;
        const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.locksafe.uk";
        if (tiktokDbAccount?.accessToken && post.videoUrl) {
          // Preferred: native short VIDEO post. PULL_FROM_URL needs the MP4 on
          // our VERIFIED domain — serve it through the proxy route (the raw Blob
          // URL would be rejected: wrong domain).
          try {
            const result = await postVideoToTikTok({
              accessToken: tiktokDbAccount.accessToken,
              caption: caption.slice(0, 2200),
              videoUrl: `${base}/api/social/video/${post.id}`,
              title: post.headline || "LockSafe",
            });
            platformResults.tiktok = result.success
              ? { success: true, postId: result.publishId }
              : { success: false, error: result.error };
          } catch (err) {
            platformResults.tiktok = { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        } else if (tiktokDbAccount?.accessToken && post.imageUrl) {
          try {
            // TikTok PULL_FROM_URL needs a JPEG on our VERIFIED domain — serve
            // the poster via the proxy route (the raw Blob URL would be rejected:
            // wrong domain + PNG).
            const tiktokImageUrl = `${base}/api/social/poster/${post.id}`;
            const result = await postPhotoToTikTok({
              accessToken: tiktokDbAccount.accessToken,
              caption: caption.slice(0, 4000),
              imageUrls: [tiktokImageUrl],
              title: post.headline || "LockSafe",
            });
            platformResults.tiktok = result.success
              ? { success: true, postId: result.publishId }
              : { success: false, error: result.error };
          } catch (err) {
            platformResults.tiktok = { success: false, error: err instanceof Error ? err.message : String(err) };
          }
        } else {
          // No connected TikTok account (or no image) — generate a script.
          try {
            const topic = post.headline || post.content.slice(0, 80);
            const script = await generateTikTokScript(topic, "security-tips");
            platformResults.tiktok = { success: true, script: JSON.stringify(script) };
          } catch (err) {
            platformResults.tiktok = {
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      }

      // Determine final status
      const anyAttempted = Object.keys(platformResults).length > 0;
      const anySuccess = Boolean(
        platformResults.facebook?.success ||
        platformResults.instagram?.success ||
        platformResults.twitter?.success ||
        platformResults.linkedin?.success ||
        platformResults.tiktok?.success
      );

      // If no platforms were attempted (all accounts inactive), keep SCHEDULED
      // so the post retries once tokens are refreshed
      if (!anyAttempted) {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: "SCHEDULED", publishError: null },
        });
        results.push({ postId: post.id, success: false, platforms: platformResults });
        continue;
      }

      // Update post with results
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: anySuccess ? "PUBLISHED" : "FAILED",
          publishedAt: anySuccess ? new Date() : null,
          facebookPostId:  platformResults.facebook?.postId  || null,
          instagramPostId: platformResults.instagram?.postId || null,
          twitterPostId:   platformResults.twitter?.postId   || null,
          linkedinPostId:  platformResults.linkedin?.postId  || null,
          tiktokPostId:    platformResults.tiktok?.postId    || null,
          tiktokScript:    platformResults.tiktok?.script    || undefined,
          // Record per-platform FAILURES even on a partial-success publish.
          // Previously publishError was set only when every platform failed, so
          // a post that reached Facebook but silently failed Twitter/TikTok was
          // marked a clean "PUBLISHED" — hiding that those channels were dead
          // (Twitter has been 0/22 with an expired token, invisible until now).
          publishError: (() => {
            const failed = [
              platformResults.facebook?.success === false  ? `Facebook: ${platformResults.facebook.error}`   : null,
              platformResults.instagram?.success === false ? `Instagram: ${platformResults.instagram.error}` : null,
              platformResults.twitter?.success === false   ? `Twitter: ${platformResults.twitter.error}`     : null,
              platformResults.linkedin?.success === false  ? `LinkedIn: ${platformResults.linkedin.error}`   : null,
              platformResults.tiktok?.success === false    ? `TikTok: ${platformResults.tiktok.error}`       : null,
            ].filter(Boolean).join("; ");
            if (failed) return anySuccess ? `Partial publish — ${failed}` : failed;
            return anySuccess ? null : "No platforms attempted";
          })(),
        },
      });

      results.push({
        postId: post.id,
        success: anySuccess,
        platforms: platformResults,
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      message: `Published ${successCount} posts, ${failedCount} failed`,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in publish-organic cron:", error);
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
