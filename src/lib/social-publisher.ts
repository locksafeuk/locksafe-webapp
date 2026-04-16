/**
 * Social Media Publisher
 *
 * Handles publishing organic posts to Facebook and Instagram
 * using the Meta Graph API.
 */

const META_API_VERSION = 'v25.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

// ==========================================
// TYPES
// ==========================================

export interface PublishResult {
  success: boolean;
  platform: 'facebook' | 'instagram';
  postId?: string;
  error?: string;
  publishedAt?: Date;
}

export interface ScheduleResult {
  success: boolean;
  scheduledTime: Date;
  scheduledPostId?: string;
  error?: string;
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

// ==========================================
// FACEBOOK PAGE PUBLISHING
// ==========================================

export async function publishToFacebook(params: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  link?: string;
  imageUrl?: string;
  scheduledTime?: Date;
}): Promise<PublishResult> {
  try {
    const { pageId, pageAccessToken, message, link, imageUrl, scheduledTime } = params;

    let endpoint = `${META_BASE_URL}/${pageId}`;
    const body: Record<string, unknown> = {
      message,
      access_token: pageAccessToken,
    };

    // Add link if provided
    if (link) {
      body.link = link;
    }

    // If there's an image, use photos endpoint
    if (imageUrl) {
      endpoint += '/photos';
      body.url = imageUrl;
      body.caption = message;
      delete body.message;
    } else {
      endpoint += '/feed';
    }

    // Schedule for future if specified
    if (scheduledTime) {
      body.published = false;
      body.scheduled_publish_time = Math.floor(scheduledTime.getTime() / 1000);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Facebook publishing failed');
    }

    return {
      success: true,
      platform: 'facebook',
      postId: data.id || data.post_id,
      publishedAt: new Date(),
    };
  } catch (error) {
    console.error('Facebook publish error:', error);
    return {
      success: false,
      platform: 'facebook',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==========================================
// INSTAGRAM PUBLISHING
// ==========================================

export async function publishToInstagram(params: {
  instagramAccountId: string;
  accessToken: string;
  caption: string;
  imageUrl: string;
  carouselItems?: string[]; // Array of image URLs for carousel
}): Promise<PublishResult> {
  try {
    const { instagramAccountId, accessToken, caption, imageUrl, carouselItems } = params;

    let containerId: string;

    if (carouselItems && carouselItems.length > 0) {
      // Carousel post
      containerId = await createInstagramCarousel({
        instagramAccountId,
        accessToken,
        caption,
        imageUrls: carouselItems,
      });
    } else {
      // Single image post
      containerId = await createInstagramMediaContainer({
        instagramAccountId,
        accessToken,
        caption,
        imageUrl,
      });
    }

    // Publish the container
    const publishResponse = await fetch(
      `${META_BASE_URL}/${instagramAccountId}/media_publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    const publishData = await publishResponse.json();

    if (!publishResponse.ok) {
      throw new Error(publishData.error?.message || 'Instagram publishing failed');
    }

    return {
      success: true,
      platform: 'instagram',
      postId: publishData.id,
      publishedAt: new Date(),
    };
  } catch (error) {
    console.error('Instagram publish error:', error);
    return {
      success: false,
      platform: 'instagram',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function createInstagramMediaContainer(params: {
  instagramAccountId: string;
  accessToken: string;
  caption: string;
  imageUrl: string;
}): Promise<string> {
  const { instagramAccountId, accessToken, caption, imageUrl } = params;

  const response = await fetch(
    `${META_BASE_URL}/${instagramAccountId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to create Instagram media container');
  }

  // Wait for container to be ready
  await waitForMediaReady(data.id, accessToken);

  return data.id;
}

async function createInstagramCarousel(params: {
  instagramAccountId: string;
  accessToken: string;
  caption: string;
  imageUrls: string[];
}): Promise<string> {
  const { instagramAccountId, accessToken, caption, imageUrls } = params;

  // Create individual media containers for each image
  const childContainers: string[] = [];

  for (const imageUrl of imageUrls) {
    const response = await fetch(
      `${META_BASE_URL}/${instagramAccountId}/media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          is_carousel_item: true,
          access_token: accessToken,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to create carousel item');
    }

    await waitForMediaReady(data.id, accessToken);
    childContainers.push(data.id);
  }

  // Create carousel container
  const carouselResponse = await fetch(
    `${META_BASE_URL}/${instagramAccountId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        caption,
        children: childContainers.join(','),
        access_token: accessToken,
      }),
    }
  );

  const carouselData = await carouselResponse.json();

  if (!carouselResponse.ok) {
    throw new Error(carouselData.error?.message || 'Failed to create carousel container');
  }

  await waitForMediaReady(carouselData.id, accessToken);

  return carouselData.id;
}

async function waitForMediaReady(
  containerId: string,
  accessToken: string,
  maxAttempts: number = 10,
  delayMs: number = 2000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `${META_BASE_URL}/${containerId}?fields=status_code&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.status_code === 'FINISHED') {
      return;
    }

    if (data.status_code === 'ERROR') {
      throw new Error('Media processing failed');
    }

    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  throw new Error('Media processing timed out');
}

// ==========================================
// CROSS-POSTING (Both Platforms)
// ==========================================

export async function publishToBothPlatforms(params: {
  pageId: string;
  pageAccessToken: string;
  instagramAccountId: string;
  instagramAccessToken: string;
  content: string;
  imageUrl?: string;
  facebookLink?: string;
  scheduledTime?: Date;
}): Promise<{ facebook: PublishResult; instagram: PublishResult }> {
  const {
    pageId,
    pageAccessToken,
    instagramAccountId,
    instagramAccessToken,
    content,
    imageUrl,
    facebookLink,
    scheduledTime,
  } = params;

  // Publish to Facebook
  const facebookResult = await publishToFacebook({
    pageId,
    pageAccessToken,
    message: content,
    link: facebookLink,
    imageUrl,
    scheduledTime,
  });

  // Publish to Instagram (requires image)
  let instagramResult: PublishResult;
  if (imageUrl) {
    instagramResult = await publishToInstagram({
      instagramAccountId,
      accessToken: instagramAccessToken,
      caption: content,
      imageUrl,
    });
  } else {
    instagramResult = {
      success: false,
      platform: 'instagram',
      error: 'Instagram requires an image for posts',
    };
  }

  return {
    facebook: facebookResult,
    instagram: instagramResult,
  };
}

// ==========================================
// ACCOUNT MANAGEMENT
// ==========================================

export async function getInstagramBusinessAccount(
  pageId: string,
  accessToken: string
): Promise<{ id: string; username: string } | null> {
  try {
    const response = await fetch(
      `${META_BASE_URL}/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`
    );

    const data = await response.json();

    if (data.instagram_business_account) {
      return {
        id: data.instagram_business_account.id,
        username: data.instagram_business_account.username,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting Instagram business account:', error);
    return null;
  }
}

export async function getPageAccessToken(
  userAccessToken: string,
  pageId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${META_BASE_URL}/${pageId}?fields=access_token&access_token=${userAccessToken}`
    );

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('Error getting page access token:', error);
    return null;
  }
}

export async function getManagedPages(
  userAccessToken: string
): Promise<Array<{ id: string; name: string; access_token: string }>> {
  try {
    const response = await fetch(
      `${META_BASE_URL}/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`
    );

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error getting managed pages:', error);
    return [];
  }
}

// ==========================================
// POST INSIGHTS
// ==========================================

export async function getPostInsights(
  postId: string,
  accessToken: string,
  platform: 'facebook' | 'instagram'
): Promise<{
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
}> {
  const defaultMetrics = {
    impressions: 0,
    reach: 0,
    engagement: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
  };

  try {
    if (platform === 'facebook') {
      // Facebook insights
      const response = await fetch(
        `${META_BASE_URL}/${postId}/insights?metric=post_impressions,post_reach,post_engaged_users,post_clicks&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.data) {
        for (const metric of data.data) {
          if (metric.name === 'post_impressions') defaultMetrics.impressions = metric.values[0]?.value || 0;
          if (metric.name === 'post_reach') defaultMetrics.reach = metric.values[0]?.value || 0;
          if (metric.name === 'post_engaged_users') defaultMetrics.engagement = metric.values[0]?.value || 0;
          if (metric.name === 'post_clicks') defaultMetrics.clicks = metric.values[0]?.value || 0;
        }
      }

      // Get reactions/comments separately
      const reactionsResponse = await fetch(
        `${META_BASE_URL}/${postId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${accessToken}`
      );

      const reactionsData = await reactionsResponse.json();
      defaultMetrics.likes = reactionsData.reactions?.summary?.total_count || 0;
      defaultMetrics.comments = reactionsData.comments?.summary?.total_count || 0;
      defaultMetrics.shares = reactionsData.shares?.count || 0;

    } else {
      // Instagram insights
      const response = await fetch(
        `${META_BASE_URL}/${postId}/insights?metric=impressions,reach,engagement,saved&access_token=${accessToken}`
      );

      const data = await response.json();

      if (data.data) {
        for (const metric of data.data) {
          if (metric.name === 'impressions') defaultMetrics.impressions = metric.values[0]?.value || 0;
          if (metric.name === 'reach') defaultMetrics.reach = metric.values[0]?.value || 0;
          if (metric.name === 'engagement') defaultMetrics.engagement = metric.values[0]?.value || 0;
          if (metric.name === 'saved') defaultMetrics.saves = metric.values[0]?.value || 0;
        }
      }

      // Get likes/comments
      const mediaResponse = await fetch(
        `${META_BASE_URL}/${postId}?fields=like_count,comments_count&access_token=${accessToken}`
      );

      const mediaData = await mediaResponse.json();
      defaultMetrics.likes = mediaData.like_count || 0;
      defaultMetrics.comments = mediaData.comments_count || 0;
    }

    return defaultMetrics;
  } catch (error) {
    console.error('Error getting post insights:', error);
    return defaultMetrics;
  }
}

export default {
  publishToFacebook,
  publishToInstagram,
  publishToBothPlatforms,
  getInstagramBusinessAccount,
  getPageAccessToken,
  getManagedPages,
  getPostInsights,
};
