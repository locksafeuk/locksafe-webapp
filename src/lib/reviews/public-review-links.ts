/**
 * public-review-links.ts — the third-party review destinations (Google, Trustpilot)
 * that AI engines actually read for "near me" recommendations.
 *
 * URLs are env-driven so the review flow can be wired NOW and activates the
 * moment the profiles exist + the env vars are set — no code change needed:
 *   NEXT_PUBLIC_GOOGLE_REVIEW_URL     e.g. https://search.google.com/local/writereview?placeid=…
 *   NEXT_PUBLIC_TRUSTPILOT_REVIEW_URL e.g. https://www.trustpilot.com/evaluate/www.locksafe.uk
 *
 * COMPLIANCE: show these to ALL customers, never only to happy/5-star ones.
 * Selective ("review-gating") solicitation violates Google's and Trustpilot's
 * policies and can get a profile penalised.
 */

export type ReviewPlatform = "google" | "trustpilot";

export interface PublicReviewLink {
  platform: ReviewPlatform;
  label: string;
  url: string;
}

export function getPublicReviewLinks(): PublicReviewLink[] {
  const links: PublicReviewLink[] = [];
  const google = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL?.trim();
  const trustpilot = process.env.NEXT_PUBLIC_TRUSTPILOT_REVIEW_URL?.trim();
  if (google) links.push({ platform: "google", label: "Review us on Google", url: google });
  if (trustpilot) links.push({ platform: "trustpilot", label: "Review us on Trustpilot", url: trustpilot });
  return links;
}

export function hasPublicReviewLinks(): boolean {
  return getPublicReviewLinks().length > 0;
}

/** Inline-styled HTML buttons for transactional emails. Empty string when unconfigured. */
export function publicReviewEmailBlock(): string {
  const links = getPublicReviewLinks();
  if (links.length === 0) return "";
  const colour: Record<ReviewPlatform, string> = { google: "#4285F4", trustpilot: "#00B67A" };
  const buttons = links
    .map(
      (l) =>
        `<a href="${l.url}" style="display:inline-block; background:${colour[l.platform]}; color:#ffffff !important; text-decoration:none; padding:12px 22px; border-radius:8px; font-size:15px; font-weight:600; margin:6px;">${l.label} →</a>`,
    )
    .join("");
  return `
    <div style="margin-top:8px; padding-top:20px; border-top:1px solid #e2e8f0; text-align:center;">
      <p style="font-size:14px; color:#334155; margin:0 0 12px;">Reviews on Google and Trustpilot help other people in your area find a trustworthy locksmith. It only takes a moment:</p>
      ${buttons}
    </div>`;
}

/** Plain-text suffix for SMS/WhatsApp. Empty string when unconfigured. */
export function publicReviewTextSuffix(): string {
  const links = getPublicReviewLinks();
  if (links.length === 0) return "";
  // SMS is short — use one link (Google preferred for local/AI reach), fall back to Trustpilot.
  const first = links.find((l) => l.platform === "google") ?? links[0];
  return ` Could you also leave a quick public review? ${first.url}`;
}
