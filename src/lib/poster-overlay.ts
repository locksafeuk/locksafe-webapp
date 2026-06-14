/**
 * Poster text overlay — composites a clean, brand-styled headline onto an
 * AI-generated background using sharp + SVG.
 *
 * Why: AI image models (Flux) render garbled, misspelled text. So we tell the
 * model to produce a TEXT-FREE background and overlay the real, proofread
 * headline here as actual font-rendered text. This guarantees zero typos and
 * exact, on-brand wording — the thing `proofreadOrganicPost` can't fix on the
 * image itself.
 */

import "@/lib/fonts"; // MUST be first: makes bundled Poppins resolvable before sharp loads
import sharp from "sharp";
import { POSTER_FONT } from "@/lib/fonts";

const BRAND = {
  orange: "#F97316",
  slate: "#1E293B",
  white: "#FFFFFF",
};

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string)
  );
}

/** Greedy word-wrap by estimated glyph width; caps at maxLines with an ellipsis. */
function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && lines.join(" ").length < text.trim().length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:!?]*$/, "") + "…";
  }
  return lines;
}

/**
 * Overlay `rawHeadline` onto `imageBuffer` (bottom-anchored, gradient scrim,
 * orange accent bar, bold white headline). Returns a PNG buffer. On any error,
 * returns the original image unchanged so generation never breaks.
 */
export async function overlayHeadline(imageBuffer: Buffer, rawHeadline: string): Promise<Buffer> {
  const headline = (rawHeadline || "").trim();
  if (!headline) return imageBuffer;

  try {
    const meta = await sharp(imageBuffer).metadata();
    const W = meta.width ?? 1080;
    const H = meta.height ?? 1350;

    const pad = Math.round(W * 0.07);
    const fontSize = Math.round(W * 0.072); // ~78px @ 1080
    const lineHeight = Math.round(fontSize * 1.18);
    const maxChars = Math.max(10, Math.floor((W - pad * 2) / (fontSize * 0.52)));
    const lines = wrapLines(headline, maxChars, 4);

    const blockH = lines.length * lineHeight;
    const accentH = Math.round(fontSize * 0.18);
    const scrimH = blockH + pad * 2 + Math.round(fontSize * 0.9);
    const scrimY = H - scrimH;
    const fadeUp = Math.round(H * 0.08);

    const barY = scrimY + pad;
    const firstLineY = barY + accentH + Math.round(fontSize * 1.25);

    const textEls = lines
      .map(
        (ln, i) =>
          `<text x="${pad}" y="${firstLineY + i * lineHeight}" ` +
          `font-family="${POSTER_FONT}" ` +
          `font-size="${fontSize}" font-weight="800" fill="${BRAND.white}" letter-spacing="-1">` +
          `${escapeXml(ln)}</text>`
      )
      .join("");

    const svg =
      `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="${BRAND.slate}" stop-opacity="0"/>` +
      `<stop offset="40%" stop-color="${BRAND.slate}" stop-opacity="0.82"/>` +
      `<stop offset="100%" stop-color="${BRAND.slate}" stop-opacity="0.96"/>` +
      `</linearGradient></defs>` +
      `<rect x="0" y="${scrimY - fadeUp}" width="${W}" height="${scrimH + fadeUp}" fill="url(#scrim)"/>` +
      `<rect x="${pad}" y="${barY}" width="${Math.round(W * 0.14)}" height="${accentH}" rx="${Math.round(accentH / 2)}" fill="${BRAND.orange}"/>` +
      `${textEls}` +
      `</svg>`;

    return await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch (err) {
    console.warn(`[poster-overlay] failed, using image without headline: ${err instanceof Error ? err.message : String(err)}`);
    return imageBuffer;
  }
}
