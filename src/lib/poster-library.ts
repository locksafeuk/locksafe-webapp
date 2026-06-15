/**
 * Poster image LIBRARY — pre-generated, text-free background assets.
 *
 * Workflow (decoupled from posting, so quality is checked BEFORE going live):
 *   1. generateLibraryAssets() runs Draw Things over a rotating prompt library,
 *      vision-gates each result, and stores the passers as PENDING_REVIEW assets.
 *   2. A human approves the keepers in the admin review page (PENDING → APPROVED).
 *   3. The posting pipeline (generate-post-images) picks an APPROVED asset and
 *      overlays the post's exact proofread headline/brand — never the model's text.
 *
 * Only runs where DRAWTHINGS_API_URL is set (the Mac agent-runner). Generation is
 * slow (~50s/image) by design — it runs ahead of time, not at post time.
 */

import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { drawThingsBackground, visionGatePass } from "@/lib/image-gen";
import { overlayBrandedPoster } from "@/lib/poster-overlay";

/** Subject prompts (brand style + "no text" suffix are added by drawThingsBackground). */
export const POSTER_PROMPTS: Array<{ theme: string; prompt: string; model?: string }> = [
  { theme: "deadbolt", prompt: "Extreme close-up of a polished brass deadbolt lock on a dark navy painted British front door, dramatic warm amber rim light, deep shadows" },
  { theme: "terraced_door", prompt: "A classic British terraced house front door at night, glowing warm porch light, wet pavement reflecting amber light, moody atmosphere" },
  { theme: "tools_flatlay", prompt: "Top-down flat lay of professional locksmith tools, lock picks and brass keys arranged on a dark slate surface, dramatic side lighting, warm amber highlights, organised" },
  { theme: "home_glow", prompt: "A modern UK home exterior at twilight with warm glowing windows, a feeling of safety and security, deep blue sky, premium real estate photography" },
  { theme: "padlock_macro", prompt: "Macro shot of a heavy brushed-steel padlock and chain with fine water droplets, dramatic moody lighting, deep blue background with a warm amber glow, high detail" },
  { theme: "locksmith_human", prompt: "A friendly professional UK locksmith in a branded uniform repairing a front door lock for a relieved homeowner on a doorstep, warm natural daylight, candid realistic documentary photography" },
  { theme: "lockedout_night", prompt: "A worried person standing outside their front door at night, locked out, lit by a warm porch light, realistic, cinematic, moody" },
  { theme: "keys_closeup", prompt: "Close-up of a set of brass and silver house keys resting on a dark wooden surface, warm directional light, shallow depth of field, premium" },
];

export interface LibraryGenSummary {
  skipped?: boolean;
  reason?: string;
  generated: number; // passed the gate → stored PENDING_REVIEW
  gatedOut: number; // failed the vision gate → not stored
  failed: number; // generation errored
  results: Array<{ theme: string; ok: boolean; status?: string; url?: string; reason?: string }>;
}

/**
 * Generate `count` new library assets, balancing across themes (fewest-stocked
 * themes first). Each is vision-gated; only passers are uploaded + stored
 * PENDING_REVIEW. Always degrades gracefully (never throws to the caller).
 */
export async function generateLibraryAssets(opts?: { count?: number }): Promise<LibraryGenSummary> {
  const count = opts?.count ?? 4;
  const base: LibraryGenSummary = { generated: 0, gatedOut: 0, failed: 0, results: [] };

  if (!process.env.DRAWTHINGS_API_URL) return { ...base, skipped: true, reason: "DRAWTHINGS_API_URL not set (runs on the Mac runner only)" };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ...base, skipped: true, reason: "BLOB_READ_WRITE_TOKEN not configured" };

  // Balance: prioritise themes with the fewest live (pending+approved) assets.
  const live = await prisma.posterAsset.groupBy({
    by: ["theme"],
    where: { status: { in: ["PENDING_REVIEW", "APPROVED"] } },
    _count: { _all: true },
  });
  const counts = new Map<string | null, number>(live.map((r) => [r.theme, r._count._all]));
  const ranked = [...POSTER_PROMPTS].sort((a, b) => (counts.get(a.theme) ?? 0) - (counts.get(b.theme) ?? 0));
  const picks = ranked.slice(0, count);

  const width = 1080;
  const height = 1350;

  for (const p of picks) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    try {
      const bg = await drawThingsBackground(p.prompt, width, height, seed);
      const gate = await visionGatePass(bg);
      if (!gate.pass) {
        base.gatedOut++;
        base.results.push({ theme: p.theme, ok: true, status: "GATED_OUT", reason: gate.reason });
        continue;
      }
      const blobPath = `poster-library/${p.theme}-${Date.now()}-${seed}.png`;
      const { url } = await put(blobPath, bg, { access: "public", contentType: "image/png" });
      await prisma.posterAsset.create({
        data: {
          url,
          status: "PENDING_REVIEW",
          prompt: p.prompt,
          theme: p.theme,
          model: p.model ?? "flux-schnell",
          width,
          height,
          visionPass: true,
          visionReason: gate.reason,
        },
      });
      base.generated++;
      base.results.push({ theme: p.theme, ok: true, status: "PENDING_REVIEW", url, reason: gate.reason });
    } catch (err) {
      base.failed++;
      base.results.push({ theme: p.theme, ok: false, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return base;
}

/**
 * Claim the next APPROVED, unused library asset for a post (atomic-ish: marks it
 * USED immediately). Returns null when the library is empty so the caller can
 * fall back to the graphic card.
 */
export async function claimApprovedAsset(postId: string): Promise<{ id: string; url: string } | null> {
  const asset = await prisma.posterAsset.findFirst({
    where: { status: "APPROVED" },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true },
  });
  if (!asset) return null;
  await prisma.posterAsset.update({
    where: { id: asset.id },
    data: { status: "USED", usedByPostId: postId, usedAt: new Date() },
  });
  return asset;
}

/**
 * Build a finished poster for a post FROM the approved library: claim an approved
 * background, overlay the post's exact proofread headline + brand, upload the
 * final image, and return its URL. Returns null when the approved pool is empty
 * (caller falls back to a graphic card). Fast — no model generation at post time.
 */
export async function buildPosterFromLibrary(postId: string, headline: string, blobPrefix: string): Promise<string | null> {
  const asset = await claimApprovedAsset(postId);
  if (!asset) return null;
  const resp = await fetch(asset.url);
  if (!resp.ok) throw new Error(`fetch library asset failed: ${resp.status}`);
  const bg = Buffer.from(await resp.arrayBuffer());
  const finalImg = headline ? await overlayBrandedPoster(bg, headline) : bg;
  const { url } = await put(`${blobPrefix}/${Date.now()}-library.png`, finalImg, {
    access: "public",
    contentType: "image/png",
  });
  return url;
}
