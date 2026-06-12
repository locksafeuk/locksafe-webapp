/**
 * TikTok content generator
 *
 * TikTok's Content Posting API requires video assets and business account verification.
 * Until we have video production capability, this module:
 *   1. Generates scripts + captions + hooks for short-form video
 *   2. Saves them to SocialPost DB records (status: DRAFT, platform: tiktok)
 *   3. These drafts can be filmed manually or used with AI video tools (Sora, etc.)
 *
 * When TikTok API access is approved:
 *   - Add TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET to env
 *   - Implement video upload via /v2/post/video/init + /v2/post/video/upload
 */

import { chat, Models } from "@/lib/llm-router";

export interface TikTokScript {
  hook: string;          // First 3 seconds — must stop the scroll
  body: string;          // Main content (20–45 seconds spoken)
  cta: string;           // Call to action (last 5 seconds)
  caption: string;       // Post caption (150 chars max for TikTok)
  hashtags: string[];    // 3–5 relevant hashtags
  b_roll: string[];      // Suggested visuals / B-roll shots
  durationEstimate: number; // Estimated video length in seconds
}

/**
 * Generate a TikTok video script for a given topic.
 * Uses the CONTENT model (llama3.1:70b via Ollama, or OpenAI fallback).
 */
export async function generateTikTokScript(
  topic: string,
  contentPillar: "security-tips" | "success-stories" | "trust-signals" | "behind-scenes" | "engagement"
): Promise<TikTokScript> {
  const systemPrompt = `You are a TikTok scriptwriter for LockSafe UK, a premium locksmith platform.
Write scripts for short-form vertical video (30–60 seconds).
Style: direct, energetic, educational. Hook must grab attention in under 3 seconds.
Always use British English. Never fear-monger — be reassuring and solution-focused.
Respond with valid JSON matching this schema:
{
  "hook": "string — opening line spoken to camera, max 15 words",
  "body": "string — main script content, conversational, 80-150 words",
  "cta": "string — closing call to action, max 20 words",
  "caption": "string — TikTok caption, max 150 chars",
  "hashtags": ["array", "of", "3-5", "hashtags", "no #"],
  "b_roll": ["array", "of", "3-5", "visual", "suggestions"],
  "durationEstimate": number
}`;

  const userPrompt = `Create a TikTok script about: "${topic}"
Content pillar: ${contentPillar}
Brand: LockSafe UK — vetted locksmiths, fast response, fair prices across the UK`;

  const response = await chat(Models.CONTENT, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], { responseFormat: "json", temperature: 0.8 });

  try {
    const parsed = JSON.parse(response.content) as TikTokScript;
    return parsed;
  } catch {
    // Fallback if JSON parse fails
    return {
      hook: `Did you know ${topic.toLowerCase()}?`,
      body: response.content.slice(0, 300),
      cta: "Search LockSafe for a trusted locksmith near you",
      caption: `${topic} | LockSafe UK`,
      hashtags: ["locksmith", "locksafe", "homesecurity", "uk"],
      b_roll: ["Locksmith at front door", "Close-up of lock mechanism", "Happy customer"],
      durationEstimate: 45,
    };
  }
}

/**
 * Check if TikTok API posting is configured (for future use)
 */
export function isTikTokApiConfigured(): boolean {
  return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

// ============================================================================
// REAL PHOTO POSTING — TikTok Content Posting API (DIRECT_POST, PHOTO)
// ----------------------------------------------------------------------------
// Requires:
//   • An audited TikTok app with the Content Posting API + video.publish scope.
//   • A user access token (stored on the SocialAccount row, platform TIKTOK).
//   • Images hosted on a URL-VERIFIED domain (PULL_FROM_URL only accepts
//     images from a domain verified in the TikTok developer portal).
// Before the audit passes, only privacy_level SELF_ONLY works.
// ============================================================================

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export interface TikTokPhotoResult {
  success: boolean;
  publishId?: string;
  status?: string;
  error?: string;
}

/** Query creator info — also the cheapest way to validate a token + audit state. */
export async function queryTikTokCreatorInfo(
  accessToken: string
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch(`${TIKTOK_API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
    });
    const json = (await res.json()) as { data?: Record<string, unknown>; error?: { code?: string; message?: string } };
    if (!res.ok || (json.error?.code && json.error.code !== "ok")) {
      return { ok: false, error: `${json.error?.code ?? res.status}: ${json.error?.message ?? "creator_info failed"}` };
    }
    return { ok: true, data: json.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Publish a PHOTO post to TikTok via the Content Posting API (DIRECT_POST).
 * `imageUrls` must be publicly reachable on a TikTok-verified domain.
 */
export async function postPhotoToTikTok(params: {
  accessToken: string;
  caption: string;
  imageUrls: string[];
  title?: string;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  wait?: boolean;
}): Promise<TikTokPhotoResult> {
  const {
    accessToken,
    caption,
    imageUrls,
    title = "LockSafe",
    privacyLevel = (process.env.TIKTOK_PRIVACY_LEVEL as "PUBLIC_TO_EVERYONE" | "SELF_ONLY") || "PUBLIC_TO_EVERYONE",
    wait = true,
  } = params;

  if (!imageUrls.length) return { success: false, error: "No image URLs provided" };

  // Surface auth/audit errors early.
  const creator = await queryTikTokCreatorInfo(accessToken);
  if (!creator.ok) return { success: false, error: `creator_info: ${creator.error}` };

  try {
    const initRes = await fetch(`${TIKTOK_API}/post/publish/content/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.slice(0, 90),
          description: caption.slice(0, 4000),
          privacy_level: privacyLevel,
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: imageUrls,
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    });

    const initJson = (await initRes.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };

    if (!initRes.ok || (initJson.error?.code && initJson.error.code !== "ok")) {
      return { success: false, error: `${initJson.error?.code ?? initRes.status}: ${initJson.error?.message ?? "init failed"}` };
    }

    const publishId = initJson.data?.publish_id;
    if (!publishId) return { success: false, error: "init returned no publish_id" };
    if (!wait) return { success: true, publishId, status: "PROCESSING" };

    const { status, failReason } = await pollTikTokStatus(accessToken, publishId);
    const ok = status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX";
    return {
      success: ok,
      publishId,
      status,
      error: ok ? undefined : `final status: ${status}${failReason ? ` (${failReason})` : ""}`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Publish a VIDEO post to TikTok via the Content Posting API (DIRECT_POST).
 * `videoUrl` must be publicly reachable on a TikTok-verified domain (use the
 * /api/social/video/[id] proxy, which serves our Blob MP4 from locksafe.uk).
 */
export async function postVideoToTikTok(params: {
  accessToken: string;
  caption: string;
  videoUrl: string;
  title?: string;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";
  wait?: boolean;
}): Promise<TikTokPhotoResult> {
  const {
    accessToken,
    caption,
    videoUrl,
    title = "LockSafe",
    privacyLevel = (process.env.TIKTOK_PRIVACY_LEVEL as "PUBLIC_TO_EVERYONE" | "SELF_ONLY") || "PUBLIC_TO_EVERYONE",
    wait = true,
  } = params;

  if (!videoUrl) return { success: false, error: "No video URL provided" };

  // Surface auth/audit errors early.
  const creator = await queryTikTokCreatorInfo(accessToken);
  if (!creator.ok) return { success: false, error: `creator_info: ${creator.error}` };

  try {
    const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.slice(0, 90),
          description: caption.slice(0, 2200),
          privacy_level: privacyLevel,
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
        post_mode: "DIRECT_POST",
        media_type: "VIDEO",
      }),
    });

    const initJson = (await initRes.json()) as {
      data?: { publish_id?: string };
      error?: { code?: string; message?: string };
    };

    if (!initRes.ok || (initJson.error?.code && initJson.error.code !== "ok")) {
      return { success: false, error: `${initJson.error?.code ?? initRes.status}: ${initJson.error?.message ?? "video init failed"}` };
    }

    const publishId = initJson.data?.publish_id;
    if (!publishId) return { success: false, error: "video init returned no publish_id" };
    if (!wait) return { success: true, publishId, status: "PROCESSING" };

    const { status, failReason } = await pollTikTokStatus(accessToken, publishId);
    const ok = status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX";
    return {
      success: ok,
      publishId,
      status,
      error: ok ? undefined : `final status: ${status}${failReason ? ` (${failReason})` : ""}`,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function pollTikTokStatus(
  accessToken: string,
  publishId: string,
  attempts = 10,
  delayMs = 6000
): Promise<{ status: string; failReason?: string }> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${TIKTOK_API}/post/publish/status/fetch/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ publish_id: publishId }),
      });
      const json = (await res.json()) as { data?: { status?: string; fail_reason?: string } };
      const status = json.data?.status;
      if (status === "PUBLISH_COMPLETE" || status === "FAILED" || status === "SEND_TO_USER_INBOX") {
        return { status, failReason: json.data?.fail_reason };
      }
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { status: "TIMEOUT" };
}

/** True when a stored OAuth user token is available for direct photo posting. */
export function isTikTokPostingEnabled(account?: { accessToken?: string | null } | null): boolean {
  return !!account?.accessToken;
}
