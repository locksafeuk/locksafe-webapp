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
const LINKEDIN_ASSETS_API = "https://api.linkedin.com/rest/assets";

function getLinkedInVersion(): string {
  // LinkedIn REST APIs require an explicit version header in YYYYMM format.
  return process.env.LINKEDIN_VERSION || "202506";
}

export interface LinkedInPostResult {
  id: string;
  url: string;
}

export interface LinkedInAuth {
  token: string;
  orgId: string;
  authorUrn?: string;
}

function getAuth(): LinkedInAuth {
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
}, auth?: LinkedInAuth): Promise<LinkedInPostResult> {
  const { token, orgId } = auth ?? getAuth();
  const author = auth?.authorUrn ?? `urn:li:organization:${orgId}`;

  const shareMedia: Array<Record<string, unknown>> = [];
  if (content.imageUrl) {
    try {
      const assetUrn = await uploadLinkedInImageAsset({
        token,
        orgId,
        imageUrl: content.imageUrl,
      });

      shareMedia.push({
        media: assetUrn,
        status: "READY",
        title: {
          text: "LockSafe UK",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const accessDeniedAssets = message.includes("partnerApiAssets.ACTION-registerUpload") || message.includes("ACCESS_DENIED");
      if (accessDeniedAssets) {
        console.warn("[LinkedIn] Image upload permission missing; publishing text-only fallback.");
      } else {
        throw error;
      }
    }
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

async function uploadLinkedInImageAsset(params: {
  token: string;
  orgId: string;
  imageUrl: string;
}): Promise<string> {
  const imageResponse = await fetch(params.imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`[LinkedIn] Failed to fetch image: ${imageResponse.status}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const registerResponse = await fetch(`${LINKEDIN_ASSETS_API}?action=registerUpload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": getLinkedInVersion(),
    },
    body: JSON.stringify({
      registerUploadRequest: {
        owner: `urn:li:organization:${params.orgId}`,
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        serviceRelationships: [
          {
            identifier: "urn:li:userGeneratedContent",
            relationshipType: "OWNER",
          },
        ],
        supportedUploadMechanism: ["SYNCHRONOUS_UPLOAD"],
      },
    }),
  });

  if (!registerResponse.ok) {
    const errorText = await registerResponse.text();
    throw new Error(`[LinkedIn] registerUpload failed ${registerResponse.status}: ${errorText}`);
  }

  const registerData = await registerResponse.json() as {
    value?: {
      asset?: string;
      uploadMechanism?: {
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: {
          uploadUrl?: string;
          headers?: Record<string, string>;
        };
      };
    };
  };

  const assetUrn = registerData.value?.asset;
  const uploadUrl = registerData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
  const uploadHeaders = registerData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.headers ?? {};

  if (!assetUrn || !uploadUrl) {
    throw new Error("[LinkedIn] registerUpload response missing asset or uploadUrl");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "LinkedIn-Version": getLinkedInVersion(),
      ...uploadHeaders,
    },
    body: imageBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`[LinkedIn] image upload failed ${uploadResponse.status}: ${errorText}`);
  }

  return assetUrn;
}

/**
 * Check if LinkedIn credentials are configured
 */
export function isLinkedInConfigured(): boolean {
  return !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_ORGANIZATION_ID);
}
