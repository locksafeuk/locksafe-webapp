/**
 * Short-form vertical video engine (TikTok / Reels / Shorts).
 *
 * Philosophy (same as the posters): **we own the text, AI makes the visuals,
 * ffmpeg stitches it.** Captions are rendered from our proofread script as real
 * Poppins font text — never AI-rendered — so there are ZERO typos. The visuals
 * are a branded animated background (or, optionally, a Veo-Lite b-roll clip),
 * and an OpenAI TTS voiceover is mixed underneath.
 *
 * Output: 1080×1920 (9:16) H.264/AAC MP4, sized natively for mobile, with
 * captions kept in the centre safe-zone clear of TikTok's right-rail and bottom
 * UI. Uploaded to Vercel Blob → served as a verified-domain MP4 for TikTok.
 *
 * IMPORTANT: This runs where `ffmpeg` is on PATH — i.e. the **Mac Studio agent
 * runner**, not Vercel serverless. Callers must degrade gracefully (see
 * `isShortVideoSupported`).
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { put } from "@vercel/blob";

// ─── Brand ─────────────────────────────────────────────────────────────────
const BRAND = {
  orange: "F97316",
  slateBg1: [13, 20, 38] as [number, number, number],
  slateBg2: [23, 36, 64] as [number, number, number],
  scrim: "0B1426",
};

const W = 1080;
const H = 1920;
const FPS = 30;

// Fonts are bundled in the repo so the host doesn't need them installed.
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const FONT_CAPTION = path.join(FONT_DIR, "Poppins-Bold.ttf");
const FONT_BADGE = path.join(FONT_DIR, "Poppins-Bold.ttf");
const FONT_WORDMARK = path.join(FONT_DIR, "Poppins-Medium.ttf");

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

/** True if ffmpeg is available on PATH (i.e. we can build video here). */
export async function isShortVideoSupported(): Promise<boolean> {
  if (_ffmpegChecked !== null) return _ffmpegChecked;
  _ffmpegChecked = await new Promise<boolean>((resolve) => {
    const p = spawn("ffmpeg", ["-version"]);
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
  return _ffmpegChecked;
}

// ─── Branded background (no PIL — pure sharp/SVG) ──────────────────────────────

/**
 * Render a 1350×2400 branded background (slate vertical gradient + two soft
 * orange glows + vignette), upscaled so the Ken-Burns zoom has room to move.
 */
async function renderBrandBackground(outPath: string): Promise<void> {
  const BW = 1350;
  const BH = 2400;
  const [r1, g1, b1] = BRAND.slateBg1;
  const [r2, g2, b2] = BRAND.slateBg2;

  const svg = `<svg width="${BW}" height="${BH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(${r1},${g1},${b1})"/>
        <stop offset="100%" stop-color="rgb(${r2},${g2},${b2})"/>
      </linearGradient>
      <radialGradient id="glowA" cx="30%" cy="22%" r="42%">
        <stop offset="0%" stop-color="#F97316" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="glowB" cx="78%" cy="72%" r="38%">
        <stop offset="0%" stop-color="#F97316" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
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

  await sharp(Buffer.from(svg)).png().toBuffer().then((buf) => writeFile(outPath, buf));
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
    // Estimate from word count; clamp so no card is too short/long to read.
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

// ─── Filtergraph (the locked, centred-caption look) ───────────────────────────

function escBadge(s: string): string {
  // Badge text is a short literal (a digit); keep it filter-safe.
  return s.replace(/[\\:']/g, "");
}

function buildFiltergraph(timed: TimedCard[], total: number, tmpDir: string): string {
  const frames = Math.round(total * FPS);
  const CAP_Y = Math.round(H * 0.46); // caption top → block sits centred
  const BADGE_Y = CAP_Y - 150; // header group just above caption
  const BAR_Y = CAP_Y - 176;
  const scrimY = Math.round(H * 0.32);
  const scrimH = Math.round(H * 0.42);
  const CW = Math.round(W * 1.25);
  const CH = Math.round(H * 1.25);

  // Background: cover-crop to frame, slow Ken-Burns zoom with a gentle drift,
  // then a centred dark scrim band for caption legibility.
  // NB: the whole filtergraph is passed as a SINGLE argv element to spawn (no
  // shell), so commas inside single-quoted expressions are literal — no
  // backslash-escaping needed (matches the validated prototype).
  const bg =
    `[0:v]scale=${CW}:${CH}:force_original_aspect_ratio=increase,crop=${CW}:${CH},` +
    `zoompan=z='min(zoom+0.0007,1.18)':x='iw/2-(iw/zoom/2)+sin(on/90)*40':y='ih/2-(ih/zoom/2)':` +
    `d=${frames}:s=${W}x${H}:fps=${FPS},setsar=1,` +
    `drawbox=x=0:y=${scrimY}:w=${W}:h=${scrimH}:color=0x${BRAND.scrim}@0.60:t=fill`;

  let dt = "";
  timed.forEach((card, i) => {
    const a = card.start.toFixed(2);
    const b = card.end.toFixed(2);
    const fade = `if(lt(t,${a}+0.30),(t-${a})/0.30,1)`;
    const between = `between(t,${a},${b})`;

    // animated orange accent bar
    dt += `,drawbox=x=(iw-220)/2:y=${BAR_Y}:w=220:h=8:color=0x${BRAND.orange}:t=fill:enable='${between}'`;

    if (card.badge) {
      dt += `,drawbox=x=(iw-96)/2:y=${BADGE_Y}:w=96:h=96:color=0x${BRAND.orange}:t=fill:enable='${between}'`;
      dt += `,drawtext=fontfile='${FONT_BADGE}':text='${escBadge(card.badge)}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=${BADGE_Y + 12}:enable='${between}'`;
    }

    dt += `,drawtext=fontfile='${FONT_CAPTION}':textfile='${path.join(tmpDir, `c${i}.txt`)}':fontcolor=white:fontsize=78:line_spacing=20:x=(w-text_w)/2:y=${CAP_Y}:alpha='${fade}':borderw=3:bordercolor=0x${BRAND.scrim}@0.85:enable='${between}'`;
  });

  // Brand watermark (small, bottom, safe zone) + TikTok-style progress bar.
  const wmY = H - 175; // nudged up into guaranteed-safe area (clear of TikTok UI)
  dt += `,drawbox=x=(iw-300)/2-26:y=${wmY + 8}:w=18:h=18:color=0x${BRAND.orange}:t=fill`;
  dt += `,drawtext=fontfile='${FONT_WORDMARK}':text='LOCKSAFE UK':fontcolor=white@0.85:fontsize=34:x=(w-text_w)/2+14:y=${wmY}`;
  dt += `,drawbox=x=0:y=${H - 10}:w='iw*t/${total.toFixed(2)}':h=10:color=0x${BRAND.orange}:t=fill`;

  return `${bg}${dt}[v]`;
}

// ─── OpenAI TTS voiceover ──────────────────────────────────────────────────────

/**
 * Synthesize a voiceover via OpenAI TTS. Returns a local mp3 path, or null if
 * OpenAI isn't configured / the call fails (video still renders, just silent).
 */
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
    const mp3 = Buffer.from(await resp.arrayBuffer());
    const out = path.join(tmpDir, "vo.mp3");
    await writeFile(out, mp3);
    return out;
  } catch (err) {
    console.warn(`[short-video] TTS failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─── ffmpeg runner ─────────────────────────────────────────────────────────────

/** Download a URL (e.g. Vercel Blob) to a local file. */
async function downloadTo(url: string, dest: string): Promise<void> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!resp.ok) throw new Error(`download ${resp.status} for ${url}`);
  await writeFile(dest, Buffer.from(await resp.arrayBuffer()));
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
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

    // Write each caption to a textfile (drawtext textfile = exact, proofread copy).
    await Promise.all(
      timed.map((c, i) => writeFile(path.join(tmpDir, `c${i}.txt`), c.text, "utf8"))
    );

    // Resolve background sources, downloading URLs to temp files if needed.
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

    const filtergraph = buildFiltergraph(timed, total, tmpDir);
    const outPath = path.join(tmpDir, "out.mp4");

    const args = ["-y", ...bgInputArgs];
    if (voPath) {
      // Real voiceover track, padded to full length with trailing silence.
      args.push("-i", voPath);
      args.push(
        "-filter_complex",
        `${filtergraph};[1:a]apad[vo]`,
        "-map", "[v]", "-map", "[vo]"
      );
    } else {
      // Silent track so the MP4 always has audio (TikTok prefers it). The
      // anullsrc is always input index 1 (background is input 0).
      args.push("-f", "lavfi", "-t", total.toFixed(2), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
      args.push("-filter_complex", filtergraph, "-map", "[v]", "-map", "1:a");
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
export function scriptToCards(script: {
  hook: string;
  body: string;
  cta: string;
}): CaptionCard[] {
  const cards: CaptionCard[] = [];
  if (script.hook?.trim()) cards.push({ text: wrapCaption(script.hook) });

  // Prefer explicit "1. … 2. …" steps; else split into ≤3 sentences.
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
