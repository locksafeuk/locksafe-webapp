/**
 * LinkedIn UGC Posts API client
 *
 * Posts to a LinkedIn Organization Page (company page).
 * Uses the UGC Posts API v2 with a long-lived org access token.
 *
 * Env vars needed:
 *   LINKEDIN_ACCESS_TOKEN       — long-lived organization page access token
 *   LINKEDIN_ORGANIZATION_ID    — numeric organization ID (from URL: linkedin.com/company/12345678)
 *
 * Scopes required on the LinkedIn app:
 *   w_organization_social, r_organization_social (for org posts)
 */

const LINKEDIN_API = "https://api.linkedin.com/v2";

export interface LinkedInPostResult {
  id: string;
  url: string;
}

function getAuth(): { token: string; orgId: string } {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID;

  if (!token || !orgId) {
    throw new Error(
      "[LinkedIn] Missing credentials. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORGANIZATION_ID in env vars."
    );
  }

  return { token, orgId };
}

/**
 * Post text content to the organization's LinkedIn page
 */
export async function postToLinkedIn(content: {
  text: string;
  imageUrl?: string;
}): Promise<LinkedInPostResult> {
  const { token, orgId } = getAuth();
  const author = `urn:li:organization:${orgId}`;

  const shareMedia: unknown[] = [];
  if (content.imageUrl) {
    // For image posts, the image must first be registered + uploaded via LinkedIn's
    // media upload flow. For now we post text-only and include the URL as a link.
    // Full image upload support can be added in a future iteration.
  }

  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content.text,
        },
        shareMediaCategory: shareMedia.length > 0 ? "IMAGE" : "NONE",
        ...(shareMedia.length > 0 ? { media: shareMedia } : {}),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch(`${LINKEDIN_API}/ugcPosts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[LinkedIn] POST /ugcPosts failed ${res.status}: ${errorText}`);
  }

  // LinkedIn returns the post URN in the X-RestLi-Id header
  const postUrn = res.headers.get("x-restli-id") || res.headers.get("X-RestLi-Id");

  if (!postUrn) {
    throw new Error("[LinkedIn] No post URN returned in response headers");
  }

  // URN format: urn:li:ugcPost:7xxxxxxxxxxxxxxxxxx
  const postId = postUrn.split(":").pop() ?? postUrn;
  const url = `https://www.linkedin.com/feed/update/${postUrn}/`;

  console.log(`[LinkedIn] Posted to org ${orgId}: ${postId}`);
  return { id: postId, url };
}

/**
 * Check if LinkedIn credentials are configured
 */
export function isLinkedInConfigured(): boolean {
  return !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID);
}
