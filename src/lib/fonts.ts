/**
 * Font bootstrap for sharp/librsvg text rendering.
 *
 * Vercel's serverless Linux has NO system fonts, so any SVG `<text>` rendered by
 * sharp comes out as empty tofu boxes (□). We ship Poppins in `assets/fonts/`
 * and point fontconfig at it via a generated config + FONTCONFIG_FILE, with a
 * writable cache dir in /tmp. Importing this module (for its side effect) BEFORE
 * the first sharp text render makes "Poppins" resolvable on Vercel and the Mac.
 *
 * Exposed as POSTER_FONT so all callers use the exact family name we bundle.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

/** The font family every poster/caption SVG must use (matches the bundled TTFs). */
export const POSTER_FONT = "Poppins, sans-serif";

/** Remove emoji/pictographs before SVG text render — bundled Poppins has no
 *  emoji glyphs and Pango fatally "bails out" on a colour-emoji request, which
 *  kills the whole poster render. Decorative icons are separate SVGs. */
export function stripEmoji(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{24C2}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}


(function setupFontconfig() {
  try {
    const fontDir = path.join(process.cwd(), "assets", "fonts");
    if (!existsSync(fontDir)) return;

    const cacheDir = path.join(os.tmpdir(), "fontconfig-cache");
    mkdirSync(cacheDir, { recursive: true });

    const confPath = path.join(os.tmpdir(), "locksafe-fonts.conf");
    const conf =
      `<?xml version="1.0"?>\n` +
      `<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n` +
      `<fontconfig>\n` +
      `  <dir>${fontDir}</dir>\n` +
      `  <cachedir>${cacheDir}</cachedir>\n` +
      `  <!-- Make any missing family fall back to our bundled Poppins -->\n` +
      `  <match target="pattern"><test name="family"><string>sans-serif</string></test>` +
      `<edit name="family" mode="prepend" binding="strong"><string>Poppins</string></edit></match>\n` +
      `</fontconfig>\n`;
    writeFileSync(confPath, conf);

    process.env.FONTCONFIG_FILE = confPath;
    process.env.FONTCONFIG_PATH = os.tmpdir();
  } catch {
    /* best-effort: on failure we fall back to whatever fonts exist */
  }
})();
