/**
 * Twitter/X API v2 client
 *
 * Uses OAuth 1.0a user-context authentication (required for posting).
 * Requires: twitter-api-v2 npm package (npm install twitter-api-v2)
 *
 * Env vars needed:
 *   TWITTER_API_KEY
 *   TWITTER_API_SECRET
 *   TWITTER_ACCESS_TOKEN
 *   TWITTER_ACCESS_SECRET
 */

// twitter-api-v2 is imported dynamically to avoid breaking builds
// when the package is not yet installed.

export interface TweetResult {
  id: string;
  text: string;
  url: string;
}

export interface ThreadResult {
  ids: string[];
  urls: string[];
  firstTweetUrl: string;
}

function getClient() {
  const { TwitterApi } = require("twitter-api-v2") as typeof import("twitter-api-v2");

  const apiKey       = process.env.TWITTER_API_KEY;
  const apiSecret    = process.env.TWITTER_API_SECRET;
  const accessToken  = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error(
      "[Twitter] Missing credentials. Set TWITTER_API_KEY, TWITTER_API_SECRET, " +
      "TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET in env vars."
    );
  }

  return new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
}

/**
 * Post a single tweet (max 280 chars)
 */
export async function postTweet(text: string): Promise<TweetResult> {
  const client = getClient();
  const { data } = await client.v2.tweet(text);

  const username = await getUsername(client);
  const url = `https://x.com/${username}/status/${data.id}`;

  console.log(`[Twitter] Posted tweet ${data.id}: ${text.slice(0, 60)}...`);
  return { id: data.id, text: data.text, url };
}

/**
 * Post a thread (reply-chain of tweets)
 * Each element in the array becomes one tweet in the thread.
 */
export async function postThread(tweets: string[]): Promise<ThreadResult> {
  if (!tweets.length) throw new Error("[Twitter] postThread: tweets array is empty");

  const client = getClient();
  const ids: string[] = [];
  let replyToId: string | undefined;

  for (const text of tweets) {
    const payload: Record<string, unknown> = { text };
    if (replyToId) {
      payload.reply = { in_reply_to_tweet_id: replyToId };
    }

    const { data } = await client.v2.tweet(payload as Parameters<typeof client.v2.tweet>[0]);
    ids.push(data.id);
    replyToId = data.id;
  }

  const username = await getUsername(client);
  const urls = ids.map((id) => `https://x.com/${username}/status/${id}`);

  console.log(`[Twitter] Posted thread of ${ids.length} tweets. First: ${ids[0]}`);
  return { ids, urls, firstTweetUrl: urls[0] };
}

/**
 * Post a tweet with an image
 */
export async function postTweetWithImage(
  text: string,
  imageBuffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg"
): Promise<TweetResult> {
  const client = getClient();

  const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType });
  const { data } = await client.v2.tweet({ text, media: { media_ids: [mediaId] } });

  const username = await getUsername(client);
  const url = `https://x.com/${username}/status/${data.id}`;

  console.log(`[Twitter] Posted tweet with image ${data.id}`);
  return { id: data.id, text: data.text, url };
}

// Cache username per cold start
let _cachedUsername: string | null = null;

async function getUsername(client: ReturnType<typeof getClient>): Promise<string> {
  if (_cachedUsername) return _cachedUsername;
  try {
    const me = await client.v2.me();
    _cachedUsername = me.data.username;
  } catch {
    _cachedUsername = "locksafeuk"; // fallback
  }
  return _cachedUsername;
}

/**
 * Check if Twitter credentials are configured
 */
export function isTwitterConfigured(): boolean {
  return !!(
    process.env.TWITTER_API_KEY &&
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_SECRET
  );
}
