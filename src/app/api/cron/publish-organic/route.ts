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
import { isTwitterConfigured, postTweet, postThread } from "@/lib/twitter";
import { isLinkedInConfigured, postToLinkedIn } from "@/lib/linkedin";
import { isTikTokApiConfigured, generateTikTokScript } from "@/lib/tiktok";
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

    // Find posts that are scheduled and ready to publish
    const postsToPublish = await prisma.socialPost.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: now,
        },
        platforms: {
          hasSome: publishablePlatforms,
        },
      },
      include: {
        pillar: true,
      },
      take: 10, // Process up to 10 posts per run
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

      // Publish to Facebook if platform is selected
      if (post.platforms.includes("FACEBOOK") && facebookAccount) {
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

      // Publish to Instagram if platform is selected, enabled, and has image
      if (post.platforms.includes("INSTAGRAM") && isPlatformEnabled("INSTAGRAM") && instagramAccount && post.imageUrl) {
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
          imageUrl: post.imageUrl,
          carouselItems: post.carouselImages.length > 0 ? post.carouselImages : undefined,
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
            if (threadParts && threadParts.length > 1) {
              const result = await postThread(threadParts);
              platformResults.twitter = { success: true, postId: result.ids[0] };
            } else {
              const result = await postTweet(tweetText.slice(0, 280));
              platformResults.twitter = { success: true, postId: result.id };
            }
          } else if (twitterDbAccount) {
            // Fallback: OAuth 2.0 DB token (may expire — reconnect via /admin/social-connect)
            const twitterClient = new TwitterApi(twitterDbAccount.accessToken);
            if (threadParts && threadParts.length > 1) {
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
            const orgId  = linkedinDbAccount.accountId;
            const token  = linkedinDbAccount.accessToken;
            // accountId may be a full URN (urn:li:person:X or urn:li:organization:X) or a bare org ID
            const author = orgId.startsWith("urn:li:") ? orgId : `urn:li:organization:${orgId}`;
            const body = {
              author,
              lifecycleState: "PUBLISHED",
              specificContent: {
                "com.linkedin.ugc.ShareContent": {
                  shareCommentary: { text: linkedinText },
                  shareMediaCategory: "NONE",
                },
              },
              visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
            };
            const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "X-Restli-Protocol-Version": "2.0.0",
              },
              body: JSON.stringify(body),
            });
            if (!res.ok) {
              const errText = await res.text();
              platformResults.linkedin = { success: false, error: `LinkedIn API ${res.status}: ${errText}` };
            } else {
              const postId = res.headers.get("x-restli-id")?.split(":").pop() || "unknown";
              platformResults.linkedin = { success: true, postId };
            }
          } else {
            const result = await postToLinkedIn({ text: linkedinText });
            platformResults.linkedin = { success: true, postId: result.id };
          }
        } catch (err) {
          platformResults.linkedin = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      // TikTok: generate video script (API video posting requires separate upload pipeline)
      if (post.platforms.includes("TIKTOK")) {
        if (tiktokApiEnabled) {
          // Future: POST to TikTok Content Posting API with a video asset
          // For now mark as pending video upload
          platformResults.tiktok = { success: true, script: undefined };
        } else {
          // No API credentials — generate a script and save it for manual/AI video production
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
          publishError: !anySuccess
            ? [
                platformResults.facebook  ? `Facebook: ${platformResults.facebook.error}`   : null,
                platformResults.instagram ? `Instagram: ${platformResults.instagram.error}` : null,
                platformResults.twitter   ? `Twitter: ${platformResults.twitter.error}`     : null,
                platformResults.linkedin  ? `LinkedIn: ${platformResults.linkedin.error}`   : null,
                platformResults.tiktok    ? `TikTok: ${platformResults.tiktok.error}`       : null,
              ].filter(Boolean).join("; ") || "No platforms attempted"
            : null,
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
