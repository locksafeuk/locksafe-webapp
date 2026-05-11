/**
 * Cookie-based A/B assignment for the intent-landing emotional hook.
 *
 * Stable, per-(slug × visitor) deterministic split: once a visitor lands on
 * `/intent/<slug>` we set `ls_intent_ab_<slug>=A|B` for 30 days. Read is
 * server-side via `next/headers` so the rendered HTML matches the variant
 * tracked by GTM.
 */
import { cookies } from "next/headers";

export type IntentVariant = "A" | "B";

export const INTENT_AB_COOKIE_PREFIX = "ls_intent_ab_";
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function cookieName(slug: string): string {
  return `${INTENT_AB_COOKIE_PREFIX}${slug}`;
}

/**
 * Resolve (or assign + persist) the A/B variant for the given landing slug.
 *
 * The caller passes `hasVariantB` so we don't fall back to "B" copy when
 * the landing has no variant defined.
 */
export async function resolveIntentVariant(
  slug: string,
  hasVariantB: boolean,
): Promise<IntentVariant> {
  if (!hasVariantB) return "A";

  const jar = await cookies();
  const existing = jar.get(cookieName(slug))?.value;
  if (existing === "A" || existing === "B") return existing;

  const assigned: IntentVariant = Math.random() < 0.5 ? "A" : "B";

  try {
    jar.set({
      name: cookieName(slug),
      value: assigned,
      maxAge: COOKIE_MAX_AGE_S,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  } catch {
    // Read-only context (e.g. generateMetadata) — cookie will be set on render.
  }

  return assigned;
}

export function pickHook(
  landing: {
    emotionalHook: string | null;
    heroSubcopy: string | null;
    emotionalHookB?: string | null;
    heroSubcopyB?: string | null;
  },
  variant: IntentVariant,
): { emotionalHook: string | null; heroSubcopy: string | null; variant: IntentVariant } {
  if (variant === "B" && landing.emotionalHookB) {
    return {
      emotionalHook: landing.emotionalHookB,
      heroSubcopy: landing.heroSubcopyB ?? landing.heroSubcopy,
      variant: "B",
    };
  }
  return {
    emotionalHook: landing.emotionalHook,
    heroSubcopy: landing.heroSubcopy,
    variant: "A",
  };
}
