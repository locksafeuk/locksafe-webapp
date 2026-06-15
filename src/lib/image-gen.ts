/**
 * Image Generation — Flux Schnell via local ComfyUI
 *
 * Workflow:
 *   1. Send a prompt to ComfyUI (Flux Schnell, 4 steps, 1024×1024)
 *   2. Poll until the image is ready (max 120s)
 *   3. Fetch the raw PNG
 *   4. Upload to Vercel Blob → return permanent URL
 *
 * ComfyUI is expected at COMFYUI_BASE_URL (default: http://localhost:8188)
 * Image storage uses BLOB_READ_WRITE_TOKEN → @vercel/blob
 */

import "@/lib/fonts"; // MUST be first: makes bundled Poppins resolvable before sharp loads
import { put } from "@vercel/blob";
import sharp from "sharp";
import { overlayHeadline, overlayBrandedPoster } from "@/lib/poster-overlay";
import { POSTER_FONT } from "@/lib/fonts";

// ─── Config ──────────────────────────────────────────────────────────────────

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL ?? "http://localhost:8188";
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 120_000; // 2 minutes max

// Draw Things local HTTP API (A1111-compatible txt2img, FLUX schnell). Set this
// ONLY on the Mac agent-runner (e.g. http://127.0.0.1:7860). Leave it unset on
// Vercel so cloud generation falls back to the free graphic card.
const DRAWTHINGS_API_URL = process.env.DRAWTHINGS_API_URL ?? "";
// Local Ollama vision model used to QA-gate generated backgrounds before they
// can be used (rejects text/artifacts). Lives on the Mac alongside Draw Things.
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const VISION_GATE_MODEL = process.env.LOCKSAFE_VISION_MODEL ?? "qwen2.5vl:7b";

// ─── Flux Schnell ComfyUI workflow ────────────────────────────────────────────

function buildFluxWorkflow(prompt: string, seed: number, width = 1024, height = 1024) {
  return {
    // 1: Load Flux Schnell diffusion model (default dtype for MPS/Apple Silicon compatibility)
    "1": {
      class_type: "UNETLoader",
      inputs: {
        unet_name: "flux1-schnell.safetensors",
        weight_dtype: "default",
      },
    },
    // 2: Load T5 + CLIP text encoders for Flux
    "2": {
      class_type: "DualCLIPLoader",
      inputs: {
        clip_name1: "t5xxl_fp16.safetensors",
        clip_name2: "text_encoder/model.safetensors",
        type: "flux",
      },
    },
    // 3: Load Flux VAE
    "3": {
      class_type: "VAELoader",
      inputs: {
        vae_name: "ae.safetensors",
      },
    },
    // 4: Encode positive prompt
    "4": {
      class_type: "CLIPTextEncodeFlux",
      inputs: {
        clip_l: prompt,
        t5xxl: prompt,
        guidance: 3.5,
        clip: ["2", 0],
      },
    },
    // 5: Empty negative conditioning (Flux Schnell doesn't use negative prompts)
    "5": {
      class_type: "CLIPTextEncodeFlux",
      inputs: {
        clip_l: "",
        t5xxl: "",
        guidance: 3.5,
        clip: ["2", 0],
      },
    },
    // 6: Empty latent
    "6": {
      class_type: "EmptySD3LatentImage",
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    // 7: Sample (Flux Schnell: 4 steps, cfg=1)
    "7": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 4,
        cfg: 1,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1,
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["6", 0],
      },
    },
    // 8: Decode latent to image
    "8": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["7", 0],
        vae: ["3", 0],
      },
    },
    // 9: Save image
    "9": {
      class_type: "SaveImage",
      inputs: {
        filename_prefix: "locksafe",
        images: ["8", 0],
      },
    },
  };
}

// ─── ComfyUI API helpers ──────────────────────────────────────────────────────

async function submitPrompt(workflow: object): Promise<string> {
  const resp = await fetch(`${COMFYUI_BASE_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`ComfyUI /prompt failed: ${resp.status} — ${text}`);
  }

  const data = await resp.json() as { prompt_id: string };
  return data.prompt_id;
}

interface HistoryOutput {
  images?: Array<{ filename: string; subfolder: string; type: string }>;
}

interface HistoryEntry {
  outputs: Record<string, HistoryOutput>;
  status: { completed: boolean; status_str: string };
}

async function pollForResult(promptId: string): Promise<{ filename: string; subfolder: string; type: string }> {
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const resp = await fetch(`${COMFYUI_BASE_URL}/history/${promptId}`);
    if (!resp.ok) continue;

    const history = await resp.json() as Record<string, HistoryEntry>;
    const entry = history[promptId];
    if (!entry) continue;

    if (!entry.status?.completed) {
      if (entry.status?.status_str === "error") {
        throw new Error(`ComfyUI generation failed: ${entry.status.status_str}`);
      }
      continue;
    }

    // Find the saved image across all output nodes
    for (const node of Object.values(entry.outputs)) {
      if (node.images?.length) {
        return node.images[0];
      }
    }
  }

  throw new Error(`ComfyUI timed out after ${MAX_WAIT_MS / 1000}s for prompt ${promptId}`);
}

async function fetchImage(filename: string, subfolder: string, type: string): Promise<Buffer> {
  const url = `${COMFYUI_BASE_URL}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ComfyUI /view failed: ${resp.status}`);
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GenerateImageOptions {
  prompt: string;
  /** 1024×1024 (square), 1080×1350 (poster/portrait), or 1200×630 (landscape/Facebook) */
  format?: "square" | "poster" | "portrait" | "landscape";
  /** Random seed; omit for random */
  seed?: number;
  /** Prefix used for the Vercel Blob path */
  blobPrefix?: string;
  /**
   * If set, this exact (proofread) headline is overlaid onto the generated
   * background as real, brand-styled text — guaranteeing zero typos. The Flux
   * background should be generated text-free (see the no-text prompt clause).
   */
  overlayHeadline?: string;
  /** Optional small kicker label above the headline (e.g. the content pillar). */
  overlayKicker?: string;
}

export interface GenerateImageResult {
  /** Vercel Blob URL (permanent) */
  url: string;
  /** Original filename from ComfyUI */
  filename: string;
  /** Generation seed used */
  seed: number;
  /** Which backend produced the background. */
  backend: "graphic" | "comfyui" | "openai" | "drawthings";
}

/** Generate a raw background buffer via local ComfyUI (fast-fails if unreachable). */
async function comfyBackground(prompt: string, width: number, height: number, seed: number): Promise<Buffer> {
  // Fast health check so we fall back quickly instead of waiting on a dead server.
  const health = await fetch(`${COMFYUI_BASE_URL}/system_stats`, { signal: AbortSignal.timeout(3_000) });
  if (!health.ok) throw new Error(`ComfyUI status ${health.status}`);

  const workflow = buildFluxWorkflow(prompt, seed, width, height);
  const promptId = await submitPrompt(workflow);
  const imageRef = await pollForResult(promptId);
  return fetchImage(imageRef.filename, imageRef.subfolder, imageRef.type);
}

/**
 * Cloud fallback: generate a background via the OpenAI Images API. Works from
 * anywhere (incl. Vercel when the Mac/ComfyUI is off). Output is resized to the
 * exact target dimensions so posters look identical regardless of backend.
 * Model is configurable via OPENAI_IMAGE_MODEL (default gpt-image-1; set to
 * "dall-e-3" if the org isn't verified for gpt-image-1).
 */
/** Single OpenAI Images call for a given model. Returns the raw image bytes. */
async function callOpenAiImage(model: string, prompt: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set — no image fallback available");

  const size = model === "dall-e-3" ? "1024x1792" : "1024x1536"; // portrait
  const body: Record<string, unknown> = { model, prompt, n: 1, size };
  if (model === "gpt-image-1") body.quality = "medium";
  // NB: do NOT send `response_format` — the current OpenAI images API rejects it
  // ("Unknown parameter"). gpt-image-1 returns b64 by default; dall-e-3 returns a
  // URL, which callOpenAiImage handles below.

  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok) {
    throw new Error(`OpenAI images ${model} ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  }
  const json = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error("OpenAI returned no image data");
}

/**
 * Cloud fallback via OpenAI Images. Tries the configured model (default
 * gpt-image-1) and AUTO-FALLS-BACK to dall-e-3 if it fails — because gpt-image-1
 * requires org verification and silently breaks the whole poster pipeline when
 * the org isn't verified. dall-e-3 needs no verification, so posters keep
 * generating. Output is normalised to the exact poster dimensions.
 */
async function openaiBackground(prompt: string, width: number, height: number): Promise<Buffer> {
  const primary = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  let raw: Buffer;
  try {
    raw = await callOpenAiImage(primary, prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (primary !== "dall-e-3") {
      console.warn(`[ImageGen] OpenAI ${primary} failed (${msg}) — retrying with dall-e-3`);
      raw = await callOpenAiImage("dall-e-3", prompt);
    } else {
      throw err;
    }
  }
  return sharp(raw).resize(width, height, { fit: "cover" }).png().toBuffer();
}

/**
 * Draw Things (local, FLUX schnell) background via its A1111-compatible HTTP API
 * (POST /sdapi/v1/txt2img). Produces a TEXT-FREE photographic background; the
 * proofread headline is overlaid separately so there are never typos in the art.
 * Generates at a capped size (long side ≤ 1024) for speed, then upscales to the
 * exact poster dimensions. Only used when DRAWTHINGS_API_URL is set (Mac runner).
 */
export async function drawThingsBackground(prompt: string, width: number, height: number, seed: number): Promise<Buffer> {
  if (!DRAWTHINGS_API_URL) throw new Error("DRAWTHINGS_API_URL not set");

  // Fast health check so we fall back quickly instead of hanging on a dead server.
  const health = await fetch(`${DRAWTHINGS_API_URL}/sdapi/v1/options`, { signal: AbortSignal.timeout(3_000) });
  if (!health.ok) throw new Error(`Draw Things status ${health.status}`);

  // Cap the generated long side at 1024 (multiple of 64) for speed; upscale after.
  const longSide = Math.max(width, height);
  const scale = Math.min(1, 1024 / longSide);
  const round64 = (n: number) => Math.max(512, Math.round((n * scale) / 64) * 64);
  const gw = round64(width);
  const gh = round64(height);

  const stylePrompt =
    `${prompt}. Cinematic premium photograph, deep navy and warm amber tones, dramatic ` +
    `lighting, shallow depth of field, generous dark empty space for a headline, ` +
    `absolutely no text, no words, no letters, no numbers, no logos, no watermark, ` +
    `no badges, no uniform writing, no signage, no shop fronts, no vehicle livery, no brand names.`;

  const resp = await fetch(`${DRAWTHINGS_API_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: stylePrompt, steps: 4, width: gw, height: gh, seed }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!resp.ok) throw new Error(`Draw Things txt2img ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

  const json = (await resp.json()) as { images?: string[] };
  const b64 = json.images?.[0]?.replace(/^data:image\/[^;]+;base64,/, "");
  if (!b64) throw new Error("Draw Things returned no image");
  const raw = Buffer.from(b64, "base64");
  return sharp(raw).resize(width, height, { fit: "cover" }).png().toBuffer();
}

/**
 * Quality gate: ask the local Ollama vision model whether a generated background
 * is clean enough to ship (no text, no mangled artifacts/hands/faces). Returns
 * pass=true to use it. Fails OPEN (pass=true) if the gate itself is unreachable —
 * a missing Ollama must never block generation — but a clear FAIL is respected.
 */
export async function visionGatePass(image: Buffer): Promise<{ pass: boolean; reason: string }> {
  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VISION_GATE_MODEL,
        prompt:
          "You are a strict QA checker for marketing POSTER BACKGROUNDS. Look at the image. " +
          "Reply on the FIRST line with exactly PASS or FAIL. FAIL if it shows ANY readable " +
          "text/letters/words/numbers/watermark/logo, OR mangled/distorted objects, deformed " +
          "hands or faces, or extra fingers. Otherwise PASS. SECOND line: a short reason.",
        images: [image.toString("base64")],
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) return { pass: true, reason: `gate unreachable (${resp.status})` };
    const data = (await resp.json()) as { response?: string };
    const text = (data.response ?? "").trim();
    const pass = /^\s*pass/i.test(text);
    return { pass, reason: text.replace(/\s+/g, " ").slice(0, 120) || "no reason given" };
  } catch (err) {
    return { pass: true, reason: `gate error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Greedy word-wrap to ~maxChars per line, capped at maxLines. */
function wrapPosterHeadline(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || "").replace(/\s+/g, " ").trim().split(" ");
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
  return lines.length ? lines : [text.trim()];
}

function xmlEsc(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

/**
 * FREE branded-graphic poster (sharp/SVG) — the default poster generator.
 * No ComfyUI, no OpenAI. A designed "quote card": deep navy→slate gradient with
 * a soft orange brand glow + vignette, a framed border, the on-brand LockSafe UK
 * wordmark, an optional pillar kicker, an orange accent rule, the CENTRED
 * headline (real Poppins text, zero typos), and a locksafe.uk footer. Reliable
 * everywhere (Vercel + Mac) via the bundled font (see @/lib/fonts), zero cost.
 */
async function graphicBackground(
  width: number,
  height: number,
  seed: number,
  headline?: string,
  kicker?: string
): Promise<Buffer> {
  const orange = "#F97316";
  const cx = width / 2;
  const wmSize = Math.round(width * 0.0667); // ~72 @ 1080 — prominent brand mark
  // Seed nudges the glow so posts aren't pixel-identical.
  const glowX = 70 + (seed % 18);
  const glowY = 12 + ((seed >> 4) % 14);

  const lines = headline ? wrapPosterHeadline(headline, 18, 4) : [];
  const fs = lines.length >= 3 ? width * 0.085 : width * 0.097;
  const lh = fs * 1.06;
  const blockH = lines.length * lh;
  const startY = height / 2 - blockH / 2 + fs * 0.78;
  const accentY = startY - fs * 0.78 - height * 0.045;
  const headEls = lines
    .map(
      (l, i) =>
        `<text x="${cx}" y="${startY + i * lh}" text-anchor="middle" font-family="${POSTER_FONT}" ` +
        `font-size="${fs.toFixed(0)}" font-weight="700" letter-spacing="-2" fill="#FFFFFF">${xmlEsc(l)}</text>`
    )
    .join("");

  const kickerEl = kicker
    ? `<text x="${cx}" y="${(accentY - 26).toFixed(0)}" text-anchor="middle" font-family="${POSTER_FONT}" font-size="26" font-weight="600" letter-spacing="6" fill="${orange}">${xmlEsc(kicker.toUpperCase())}</text>`
    : "";

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#0b1426"/><stop offset="55%" stop-color="#101c33"/><stop offset="100%" stop-color="#0a1322"/>
      </linearGradient>
      <radialGradient id="gl" cx="${glowX}%" cy="${glowY}%" r="55%">
        <stop offset="0%" stop-color="${orange}" stop-opacity="0.30"/><stop offset="100%" stop-color="${orange}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vig" cx="50%" cy="48%" r="72%">
        <stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#gl)"/>
    <rect width="${width}" height="${height}" fill="url(#vig)"/>
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="26" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>
    <text x="${cx}" y="${(height * 0.115).toFixed(0)}" text-anchor="middle" font-family="${POSTER_FONT}" font-size="${wmSize}" font-weight="800" letter-spacing="0.5"><tspan fill="#ffffff">Lock</tspan><tspan fill="${orange}">Safe</tspan><tspan fill="#ffffff" letter-spacing="2"> UK</tspan></text>
    ${kickerEl}
    <rect x="${cx - 44}" y="${accentY.toFixed(0)}" width="88" height="7" rx="3.5" fill="${orange}"/>
    ${headEls}
    <text x="${cx}" y="${(height - height * 0.067).toFixed(0)}" text-anchor="middle" font-family="${POSTER_FONT}" font-size="30" font-weight="600" letter-spacing="3" fill="#ffffff" fill-opacity="0.55">locksafe.uk</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Generate a branded poster image and upload to Vercel Blob. Returns the
 * permanent public URL.
 *
 * Default = FREE graphic backgrounds (sharp/SVG). Set LOCKSAFE_POSTER_MODE=ai to
 * use the AI path (ComfyUI → OpenAI) instead — only worth it once ComfyUI is
 * reliably up or the OpenAI org is verified for gpt-image-1.
 */
export async function generateImage(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  const { prompt, format = "square", blobPrefix = "social" } = opts;
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);

  const dimensions: Record<string, [number, number]> = {
    square:    [1024, 1024],
    poster:    [1080, 1350],  // poster-style 4:5 composition
    portrait:  [832, 1040],   // legacy alias for ~4:5 Instagram
    landscape: [1216, 768],   // ~19:12 for Facebook/Twitter
  };

  const [width, height] = dimensions[format];

  // Default: FREE branded-graphic background (sharp/SVG) — reliable, zero cost,
  // no ComfyUI/OpenAI dependency. Opt into AI backgrounds with LOCKSAFE_POSTER_MODE=ai.
  let imageBuffer: Buffer;
  let backend: "graphic" | "comfyui" | "openai" | "drawthings";
  const mode = process.env.LOCKSAFE_POSTER_MODE ?? "graphic";

  if (mode === "drawthings" && DRAWTHINGS_API_URL) {
    // Real-image posters via local Draw Things, QA-gated, with graphic fallback.
    try {
      let bg: Buffer | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        console.log(`[ImageGen] Draw Things background (${width}×${height}, seed=${seed + attempt}, try ${attempt + 1})...`);
        const candidate = await drawThingsBackground(prompt, width, height, seed + attempt);
        const gate = await visionGatePass(candidate);
        console.log(`[ImageGen] Vision gate: ${gate.pass ? "PASS" : "FAIL"} — ${gate.reason}`);
        if (gate.pass) { bg = candidate; break; }
      }
      if (!bg) throw new Error("all Draw Things candidates failed the vision gate");
      // Text-free background → overlay full brand furniture (wordmark + headline +
      // footer) as real text, matching the graphic cards over the photo.
      imageBuffer = opts.overlayHeadline ? await overlayBrandedPoster(bg, opts.overlayHeadline) : bg;
      backend = "drawthings";
    } catch (dtErr) {
      const msg = dtErr instanceof Error ? dtErr.message : String(dtErr);
      console.warn(`[ImageGen] Draw Things unavailable (${msg}) — falling back to graphic card`);
      imageBuffer = await graphicBackground(width, height, seed, opts.overlayHeadline, opts.overlayKicker);
      backend = "graphic";
    }
  } else if (mode === "ai") {
    try {
      console.log(`[ImageGen] Generating via ComfyUI (${width}×${height}, seed=${seed})...`);
      imageBuffer = await comfyBackground(prompt, width, height, seed);
      backend = "comfyui";
    } catch (comfyErr) {
      const msg = comfyErr instanceof Error ? comfyErr.message : String(comfyErr);
      console.warn(`[ImageGen] ComfyUI unavailable (${msg}) — falling back to OpenAI`);
      imageBuffer = await openaiBackground(prompt, width, height);
      backend = "openai";
    }
    // AI background is text-free → overlay the proofread headline as real text.
    if (opts.overlayHeadline) {
      imageBuffer = await overlayHeadline(imageBuffer, opts.overlayHeadline);
    }
  } else {
    console.log(`[ImageGen] Generating FREE graphic poster (${width}×${height}, seed=${seed})...`);
    // The designed card renders the headline (+ kicker) itself — no separate overlay.
    imageBuffer = await graphicBackground(width, height, seed, opts.overlayHeadline, opts.overlayKicker);
    backend = "graphic";
  }

  // Upload to Vercel Blob
  const blobPath = `${blobPrefix}/${Date.now()}-${backend}-${seed}.png`;
  const { url } = await put(blobPath, imageBuffer, {
    access: "public",
    contentType: "image/png",
  });

  console.log(`[ImageGen] Uploaded (${backend}) to Vercel Blob: ${url}`);

  return { url, filename: `${backend}-${seed}.png`, seed, backend };
}

/**
 * Enhance a raw image prompt with Ollama for better Flux image quality.
 * Adds photographic style, poster composition, and lighting details.
 */
export async function enhanceImagePrompt(rawPrompt: string): Promise<string> {
  const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

  try {
    const resp = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3:70b",
        prompt: `You are a professional image prompt engineer for Flux image generation.
      Enhance this social media image concept into a detailed Flux poster prompt.
      Add: bold poster composition, generous copy-safe space, photographic style, lighting, color palette, and mood.
Keep it under 200 words. Return ONLY the enhanced prompt, no explanations.

Concept: ${rawPrompt}`,
        stream: false,
        options: { temperature: 0.6, num_predict: 200 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!resp.ok) throw new Error(`Ollama status ${resp.status}`);
    const data = await resp.json() as { response: string };
    return data.response.trim();
  } catch {
    // Return a poster-oriented fallback if Ollama is unavailable.
    return `${rawPrompt}\n\nPoster composition: bold central subject, clean headline-safe space, minimal background clutter, high-contrast lighting, branded orange and slate accents, social-media poster layout.`;
  }
}
