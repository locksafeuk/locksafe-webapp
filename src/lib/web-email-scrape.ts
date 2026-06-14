/**
 * Reusable website email-harvesting + UK-mobile normalisation for the lead
 * scrapers. Visits a business website (+ /contact, /contact-us) and pulls the
 * first plausible contact email, filtering out asset filenames + junk domains.
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const EMAIL_FILE_EXT_PATTERN = /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?)$/i;
const EMAIL_BLOCKLIST = [
  "example.com", "sentry.io", "wixpress.com", "squarespace.com",
  "godaddy.com", "domain.com", "yourdomain", "email.com", "sentry-next.wixpress",
];

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[),.;]+$/, "");
}

export function extractEmailsFromHtml(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) ?? [];
  const emails = matches
    .map(sanitizeEmail)
    .filter(
      (e) =>
        e.includes("@") &&
        !EMAIL_FILE_EXT_PATTERN.test(e) &&
        !EMAIL_BLOCKLIST.some((b) => e.includes(b)),
    );
  return [...new Set(emails)];
}

async function fetchHtml(url: string, timeoutMs = 5000): Promise<string> {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    new URL(normalized);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(normalized, {
        signal: controller.signal,
        headers: { "User-Agent": "LocksafeBot/1.0 (+https://www.locksafe.uk)" },
      });
      if (!res.ok) return "";
      return (await res.text()).slice(0, 300_000);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return "";
  }
}

/** Harvest the first contact email from a business website (homepage + contact
 *  pages). Returns "" if none found / site unreachable. */
export async function extractEmailFromWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl) return "";
  const base = (websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).replace(/\/$/, "");
  const pages = [base, `${base}/contact`, `${base}/contact-us`];
  for (const page of pages) {
    const html = await fetchHtml(page);
    if (!html) continue;
    const emails = extractEmailsFromHtml(html);
    if (emails.length > 0) return emails[0];
  }
  return "";
}

/** Normalise to a UK MOBILE in +44 E.164 (+447XXXXXXXXX). Returns null for
 *  anything that isn't a UK mobile (landlines/geographic can't get SMS). */
export function toUkMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = d.slice(1);
  else if (d.startsWith("44")) {/* ok */}
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  else if (d.startsWith("7") && d.length === 10) d = "44" + d;
  else return null;
  return /^447\d{9}$/.test(d) ? "+" + d : null;
}
