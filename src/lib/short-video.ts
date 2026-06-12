/**
 * Short-form vertical video engine (TikTok / Reels / Shorts).
 *
 * Philosophy (same as the posters): **we own the text, AI makes the visuals,
 * ffmpeg stitches it.** Captions are rendered from our proofread script as real
 * font text via **sharp/SVG** (identical to the poster pipeline) — never
 * AI-rendered, so ZERO typos. Each caption is rasterised to a transparent PNG
 * and composited with ffmpeg's `overlay` filter; we deliberately avoid ffmpeg's
 * `drawtext` because some Homebrew ffmpeg bottles ship without libfreetype, and
 * `overlay`/`drawbox`/`zoompan` are universally available.
 *
 * Output: 1080×1920 (9:16) H.264/AAC MP4, sized natively for mobile, captions in
 * the centre safe-zone (clear of TikTok's right-rail + bottom UI). An OpenAI TTS
 * voiceover is mixed underneath. Uploaded to Vercel Blob → served as a
 * verified-domain MP4 for TikTok.
 *
 * IMPORTANT: This runs where `ffmpeg` is on PATH — i.e. the **Mac Studio agent
 * runner**, not Vercel serverless. Callers must degrade gracefully (see
 * `isShortVideoSupported`). Set `FFMPEG_PATH` to override the binary.
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { put } from "@vercel/blob";

// ─── Brand ─────────────────────────────────────────────────────────────────
const BRAND = {
  orange: "#F97316",
  white: "#FFFFFF",
  scrim: "#0B1426",
  slateBg1: "rgb(13,20,38)",
  slateBg2: "rgb(23,36,64)",
};

const W = 1080;
const H = 1920;
const FPS = 30;
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

// Caption font: prefer Poppins (bundled in repo + auto-installed below), but
// fall back to Helvetica Neue — which every macOS has and the poster pipeline
// already renders successfully — so captions ALWAYS render.
const CAPTION_FONT_FAMILY = `'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

/**
 * Best-effort: copy the bundled Poppins TTFs into the user's font dir so
 * sharp/fontconfig can resolve `font-family: Poppins`. Runs once at import,
 * before any render, so a fresh process picks the fonts up. Silent on failure
 * (we fall back to Helvetica Neue in the SVG font stack).
 */
(function ensureFontsInstalled() {
  try {
    if (!existsSync(FONT_DIR)) return;
    const dest = path.join(homedir(), "Library", "Fonts");
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    for (const f of readdirSync(FONT_DIR)) {
      if (!f.toLowerCase().endsWith(".ttf")) continue;
      const target = path.join(dest, f);
      if (!existsSync(target)) copyFileSync(path.join(FONT_DIR, f), target);
    }
  } catch {
    /* fall back to Helvetica Neue */
  }
})();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CaptionCard {
  /** Optional step number shown in an orange badge (e.g. "1", "2", "3"). */
  badge?: string;
  /** Caption text. Use "\n" for explicit line breaks (kept verbatim — proofread). */
  text: string;
}

export interface ShortVideoOptions {
  /** Ordered caption cards. Timing is distributed evenly unless `seconds` given. */
  cards: CaptionCard[];
  /** Optional explicit per-card durations (seconds). Length must match `cards`. */
  seconds?: number[];
  /** Voiceover script. If set and OpenAI is configured, TTS audio is mixed in. */
  voiceover?: string;
  /**
   * Optional background. Provide ONE (path takes precedence over URL):
   *  - `backgroundVideoPath` / `backgroundVideoUrl`: an mp4 (e.g. Veo-Lite b-roll)
   *  - `backgroundImagePath` / `backgroundImageUrl`: a still (e.g. a Flux poster) → Ken-Burns
   *  - none: a generated branded gradient is used.
   * URLs (e.g. Vercel Blob) are downloaded to a temp file automatically.
   */
  backgroundVideoPath?: string;
  backgroundImagePath?: string;
  backgroundVideoUrl?: string;
  backgroundImageUrl?: string;
  /** Vercel Blob path prefix. */
  blobPrefix?: string;
  /** Caption per second of speech, used to estimate timing. Default 2.6 words/s. */
  wordsPerSecond?: number;
}

export interface ShortVideoResult {
  /** Vercel Blob URL of the finished MP4. */
  url: string;
  durationSeconds: number;
  hasVoiceover: boolean;
  background: "veo" | "poster" | "gradient";
}

// ─── Capability check ─────────────────────────────────────────────────────────

let _ffmpegChecked: boolean | null = null;

/** True if ffmpeg is available (i.e. we can build video here). */
export async function isShortVideoSupported(): Promise<boolean> {
  if (_ffmpegChecked !== null) return _ffmpegChecked;
  _ffmpegChecked = await new Promise<boolean>((resolve) => {
    const p = spawn(FFMPEG, ["-version"]);
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
  return _ffmpegChecked;
}

// ─── SVG helpers ───────────────────────────────────────────────────────────────

function escXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string)
  );
}

// Layout (matches the look locked with the user: centred caption block, badge +
// accent bar grouped just above, small bottom wordmark, progress bar).
const CAP_TOP = Math.round(H * 0.46); // top of the caption text block
const FONT_SIZE = 78;
const LINE_H = 100;
const BADGE_Y = CAP_TOP - 150;
const BAR_Y = CAP_TOP - 176;

/** Render one caption card to a full-frame transparent PNG (accent bar + badge + text). */
async function renderCaptionPng(card: CaptionCard, outPath: string): Promise<void> {
  const lines = card.text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4);
  const cx = W / 2;

  const accent = `<rect x="${(W - 220) / 2}" y="${BAR_Y}" width="220" height="8" rx="4" fill="${BRAND.orange}"/>`;

  let badge = "";
  if (card.badge) {
    badge =
      `<rect x="${(W - 96) / 2}" y="${BADGE_Y}" width="96" height="96" rx="14" fill="${BRAND.orange}"/>` +
      `<text x="${cx}" y="${BADGE_Y + 66}" text-anchor="middle" font-family="${CAPTION_FONT_FAMILY}" ` +
      `font-size="60" font-weight="700" fill="${BRAND.white}">${escXml(card.badge)}</text>`;
  }

  const textEls = lines
    .map((ln, i) => {
      const baseline = CAP_TOP + FONT_SIZE + i * LINE_H;
      const safe = escXml(ln);
      // dark shadow copy behind for legibility, white on top
      return (
        `<text x="${cx + 2}" y="${baseline + 3}" text-anchor="middle" font-family="${CAPTION_FONT_FAMILY}" ` +
        `font-size="${FONT_SIZE}" font-weight="700" fill="${BRAND.scrim}" fill-opacity="0.85">${safe}</text>` +
        `<text x="${cx}" y="${baseline}" text-anchor="middle" font-family="${CAPTION_FONT_FAMILY}" ` +
        `font-size="${FONT_SIZE}" font-weight="700" fill="${BRAND.white}">${safe}</text>`
      );
    })
    .join("");

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${accent}${badge}${textEls}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(outPath, buf);
}

/** Render the persistent brand wordmark (orange dot + LOCKSAFE UK) to a PNG. */
async function renderWordmarkPng(outPath: string): Promise<void> {
  const wmY = H - 175;
  const svg =
    `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="${W / 2 - 110}" y="${wmY - 12}" width="16" height="16" rx="3" fill="${BRAND.orange}"/>` +
    `<text x="${W / 2 + 12}" y="${wmY + 2}" text-anchor="middle" font-family="${CAPTION_FONT_FAMILY}" ` +
    `font-size="34" font-weight="500" fill="${BRAND.white}" fill-opacity="0.85">LOCKSAFE UK</text>` +
    `</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(outPath, buf);
}

/** Render the branded gradient background (slate + twin orange glows + vignette). */
async function renderBrandBackground(outPath: string): Promise<void> {
  const BW = 1350;
  const BH = 2400;
  const svg = `<svg width="${BW}" height="${BH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${BRAND.slateBg1}"/>
        <stop offset="100%" stop-color="${BRAND.slateBg2}"/>
      </linearGradient>
      <radialGradient id="glowA" cx="30%" cy="22%" r="42%">
        <stop offset="0%" stop-color="${BRAND.orange}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${BRAND.orange}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glowB" cx="78%" cy="72%" r="38%">
        <stop offset="0%" stop-color="${BRAND.orange}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${BRAND.orange}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vig" cx="50%" cy="50%" r="75%">
        <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.55"/>
      </radialGradient>
    </defs>
    <rect width="${BW}" height="${BH}" fill="url(#bg)"/>
    <rect width="${BW}" height="${BH}" fill="url(#glowA)"/>
    <rect width="${BW}" height="${BH}" fill="url(#glowB)"/>
    <rect width="${BW}" height="${BH}" fill="url(#vig)"/>
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(outPath, buf);
}

/** Normalise an arbitrary still to the 1350×2400 background canvas (cover). */
async function normaliseBackgroundImage(srcPath: string, outPath: string): Promise<void> {
  const buf = await sharp(srcPath).resize(1350, 2400, { fit: "cover" }).png().toBuffer();
  await writeFile(outPath, buf);
}

// ─── Caption timing ───────────────────────────────────────────────────────────

interface TimedCard extends CaptionCard {
  start: number;
  end: number;
}

function planTiming(opts: ShortVideoOptions): { cards: TimedCard[]; total: number } {
  const { cards } = opts;
  const wps = opts.wordsPerSecond ?? 2.6;

  let durations: number[];
  if (opts.seconds && opts.seconds.length === cards.length) {
    durations = opts.seconds;
  } else {
    durations = cards.map((c) => {
      const words = c.text.replace(/\n/g, " ").trim().split(/\s+/).length;
      return Math.min(5.0, Math.max(2.4, words / wps + 0.8));
    });
  }

  const timed: TimedCard[] = [];
  let t = 0;
  for (let i = 0; i < cards.length; i++) {
    timed.push({ ...cards[i], start: t, end: t + durations[i] });
    t += durations[i];
  }
  return { cards: timed, total: t };
}

// ─── Filtergraph (overlay-based, no drawtext) ──────────────────────────────────

/**
 * Build the filter_complex. Inputs (in order):
 *   0           background (looped image or looping video)
 *   1..K        caption PNGs (one per card)
 *   K+1         wordmark PNG (persistent)
 *   K+2         audio (anullsrc or voiceover)
 */
function buildFiltergraph(timed: TimedCard[], total: number): { filter: string; audioInput: number } {
  const frames = Math.round(total * FPS);
  const CW = Math.round(W * 1.25);
  const CH = Math.round(H * 1.25);
  const scrimY = Math.round(H * 0.32);
  const scrimH = Math.round(H * 0.42);
  const K = timed.length;

  // Background: cover-crop, slow Ken-Burns zoom with gentle drift, centred scrim.
  let g =
    `[0:v]scale=${CW}:${CH}:force_original_aspect_ratio=increase,crop=${CW}:${CH},` +
    `zoompan=z='min(zoom+0.0007,1.18)':x='iw/2-(iw/zoom/2)+sin(on/90)*40':y='ih/2-(ih/zoom/2)':` +
    `d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1,` +
    `drawbox=x=0:y=${scrimY}:w=${W}:h=${scrimH}:color=${BRAND.scrim.replace("#", "0x")}@0.60:t=fill[bg];`;

  // Overlay each caption with a 0.3s alpha fade-in, gated to its time window.
  let prev = "bg";
  timed.forEach((card, i) => {
    const a = card.start.toFixed(2);
    const b = card.end.toFixed(2);
    g += `[${i + 1}:v]format=yuva420p,fade=t=in:st=${a}:d=0.30:alpha=1[c${i}];`;
    g += `[${prev}][c${i}]overlay=enable='between(t,${a},${b})'[v${i}];`;
    prev = `v${i}`;
  });

  // Persistent wordmark.
  g += `[${K + 1}:v]format=yuva420p[wm];[${prev}][wm]overlay[vw];`;

  // TikTok-style progress bar.
  g += `[vw]drawbox=x=0:y=${H - 10}:w='iw*t/${total.toFixed(2)}':h=10:color=${BRAND.orange.replace("#", "0x")}:t=fill[v]`;

  return { filter: g, audioInput: K + 2 };
}

// ─── OpenAI TTS voiceover ──────────────────────────────────────────────────────

async function synthesizeVoiceover(text: string, tmpDir: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !text.trim()) return null;
  try {
    const resp = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
        voice: process.env.OPENAI_TTS_VOICE ?? "onyx",
        input: text,
        response_format: "mp3",
        speed: 1.0,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      console.warn(`[short-video] TTS ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
      return null;
    }
    const out = path.join(tmpDir, "vo.mp3");
    await writeFile(out, Buffer.from(await resp.arrayBuffer()));
    return out;
  } catch (err) {
    console.warn(`[short-video] TTS failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── ffmpeg runner ─────────────────────────────────────────────────────────────

async function downloadTo(url: string, dest: string): Promise<void> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!resp.ok) throw new Error(`download ${resp.status} for ${url}`);
  await writeFile(dest, Buffer.from(await resp.arrayBuffer()));
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args);
    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-1200)}`))
    );
  });
}

// ─── Public: render a short video ──────────────────────────────────────────────

export async function generateShortVideo(opts: ShortVideoOptions): Promise<ShortVideoResult> {
  if (!opts.cards.length) throw new Error("generateShortVideo: no caption cards");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN not configured");
  if (!(await isShortVideoSupported())) throw new Error("ffmpeg not available on this host");

  const tmpDir = await mkdtemp(path.join(tmpdir(), "lsv-"));
  try {
    const { cards: timed, total } = planTiming(opts);

    // Render caption PNGs + wordmark (sharp/SVG — exact, proofread copy).
    const capPaths = timed.map((_, i) => path.join(tmpDir, `cap${i}.png`));
    const wmPath = path.join(tmpDir, "wm.png");
    await Promise.all([
      ...timed.map((c, i) => renderCaptionPng(c, capPaths[i])),
      renderWordmarkPng(wmPath),
    ]);

    // Resolve background (download URLs if needed).
    let videoPath = opts.backgroundVideoPath;
    if (!videoPath && opts.backgroundVideoUrl) {
      videoPath = path.join(tmpDir, "bgvid.mp4");
      await downloadTo(opts.backgroundVideoUrl, videoPath);
    }
    let imagePath = opts.backgroundImagePath;
    if (!videoPath && !imagePath && opts.backgroundImageUrl) {
      imagePath = path.join(tmpDir, "bgsrc.img");
      await downloadTo(opts.backgroundImageUrl, imagePath);
    }

    let background: ShortVideoResult["background"];
    let bgInputArgs: string[];
    const bgPng = path.join(tmpDir, "bg.png");
    if (videoPath) {
      background = "veo";
      bgInputArgs = ["-stream_loop", "-1", "-t", total.toFixed(2), "-i", videoPath];
    } else {
      if (imagePath) {
        background = "poster";
        await normaliseBackgroundImage(imagePath, bgPng);
      } else {
        background = "gradient";
        await renderBrandBackground(bgPng);
      }
      bgInputArgs = ["-loop", "1", "-t", total.toFixed(2), "-i", bgPng];
    }

    // Optional voiceover.
    const voPath = opts.voiceover ? await synthesizeVoiceover(opts.voiceover, tmpDir) : null;

    // Assemble inputs: bg, captions…, wordmark, audio.
    const { filter, audioInput } = buildFiltergraph(timed, total);
    const args = ["-y", ...bgInputArgs];
    for (const cp of capPaths) args.push("-loop", "1", "-t", total.toFixed(2), "-i", cp);
    args.push("-loop", "1", "-t", total.toFixed(2), "-i", wmPath);

    const outPath = path.join(tmpDir, "out.mp4");
    if (voPath) {
      args.push("-i", voPath);
      args.push("-filter_complex", `${filter};[${audioInput}:a]apad[vo]`, "-map", "[v]", "-map", "[vo]");
    } else {
      args.push("-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
      args.push("-filter_complex", filter, "-map", "[v]", "-map", `${audioInput}:a`);
    }
    args.push(
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
      "-t", total.toFixed(2), outPath
    );

    await runFfmpeg(args);

    const mp4 = await readFile(outPath);
    const blobPath = `${opts.blobPrefix ?? "social/video"}/${Date.now()}-short.mp4`;
    const { url } = await put(blobPath, mp4, { access: "public", contentType: "video/mp4" });

    return { url, durationSeconds: total, hasVoiceover: !!voPath, background };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─── Script → caption cards ────────────────────────────────────────────────────

/** Wrap a string to ~`maxChars` per line, max `maxLines` lines (for captions). */
function wrapCaption(text: string, maxChars = 22, maxLines = 3): string {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (cand.length <= maxChars) line = cand;
    else {
      if (line) lines.push(line);
      line = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.join("\n");
}

/**
 * Turn a proofread TikTok script into timed caption cards: a hook card, one card
 * per numbered body step (badged 1/2/3…), and a CTA card. Splits the body on
 * sentence boundaries when no explicit steps exist.
 */
export function scriptToCards(script: { hook: string; body: string; cta: string }): CaptionCard[] {
  const cards: CaptionCard[] = [];
  if (script.hook?.trim()) cards.push({ text: wrapCaption(script.hook) });

  const stepMatches = script.body.match(/\d+[.)]\s+[^0-9]+/g);
  if (stepMatches && stepMatches.length >= 2) {
    stepMatches.slice(0, 4).forEach((s, i) => {
      const clean = s.replace(/^\d+[.)]\s*/, "").trim();
      cards.push({ badge: String(i + 1), text: wrapCaption(clean) });
    });
  } else {
    const sentences = script.body.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).slice(0, 3);
    sentences.forEach((s, i) => cards.push({ badge: String(i + 1), text: wrapCaption(s.trim()) }));
  }

  if (script.cta?.trim()) cards.push({ text: wrapCaption(script.cta) });
  return cards;
}
