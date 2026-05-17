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
