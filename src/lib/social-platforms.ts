/**
 * Organic social platform availability switches.
 *
 * Instagram is currently PAUSED ("for the moment", 2026-06). Rather than
 * deleting the Instagram integration, we gate it behind a single flag so it
 * can be switched back on instantly. The OAuth connect/callback routes, the
 * `SocialPlatform.INSTAGRAM` enum value, and the publisher/insight functions
 * (`publishToInstagram`, `getPostInsights(..., "instagram")`) are all left
 * intact — only generation, publishing, and metric-syncing skip Instagram.
 *
 * To re-enable Instagram: set INSTAGRAM_ENABLED = true. No rebuild of the
 * integration required.
 */

import { SocialPlatform } from "@prisma/client";

/** Master switch for organic Instagram. Flip to `true` to re-enable. */
export const INSTAGRAM_ENABLED = false;

/** Platform names disabled org-wide for organic posting. */
const DISABLED_PLATFORMS = new Set<string>(
  INSTAGRAM_ENABLED ? [] : ["INSTAGRAM"]
);

/** True if the given platform is currently enabled for organic posting. */
export function isPlatformEnabled(platform: SocialPlatform | string): boolean {
  return !DISABLED_PLATFORMS.has(platform as string);
}

/** Remove any currently-disabled platforms (e.g. Instagram) from a list. */
export function filterEnabledPlatforms<T extends SocialPlatform | string>(
  platforms: T[]
): T[] {
  return platforms.filter((p) => isPlatformEnabled(p));
}
