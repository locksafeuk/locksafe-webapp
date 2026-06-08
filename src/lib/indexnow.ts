/**
 * IndexNow — instant URL submission to Bing, Yandex, Seznam, etc. (Google does
 * NOT participate, but for the engines that do this gets new/changed pages
 * crawled in hours instead of days).
 *
 * Setup: the verification key is hosted as a static file at
 * https://www.locksafe.uk/{INDEXNOW_KEY}.txt (see public/). The key in that
 * file MUST match INDEXNOW_KEY below.
 *
 * Submit via the admin endpoint /api/indexnow (GET = submit the whole
 * alternatives surface; POST { urls } = submit arbitrary URLs).
 */
import { getAllCompetitorSlugs } from "@/lib/competitor-alternatives";
import { SITE_URL } from "@/lib/config";
import { localizedAltPairs } from "@/lib/coverage-cities";

export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY || "48b7985d0382e9137d7ceda8aec29e42";

const BASE = SITE_URL.replace(/\/$/, "");

function host(): string {
  try {
    return new URL(SITE_URL).host;
  } catch {
    return "www.locksafe.uk";
  }
}

/**
 * Submit a batch of URLs to IndexNow. De-duplicates and caps at 10,000 (the
 * IndexNow per-request limit). Returns how many were submitted + the HTTP
 * status (200/202 = accepted).
 */
export async function submitToIndexNow(
  urls: string[],
): Promise<{ submitted: number; status: number | null }> {
  const list = Array.from(new Set(urls.filter(Boolean))).slice(0, 10000);
  if (list.length === 0) return { submitted: 0, status: null };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: host(),
      key: INDEXNOW_KEY,
      keyLocation: `${BASE}/${INDEXNOW_KEY}.txt`,
      urlList: list,
    }),
  });

  return { submitted: list.length, status: res.status };
}

/** Every competitor-alternative URL: hub + national + localized city pages. */
export function alternativeUrls(): string[] {
  const urls = [`${BASE}/alternatives`];
  for (const slug of getAllCompetitorSlugs()) {
    urls.push(`${BASE}/alternatives/${slug}`);
  }
  for (const { competitor, city } of localizedAltPairs()) {
    urls.push(`${BASE}/alternatives/${competitor}/in/${city}`);
  }
  return urls;
}
