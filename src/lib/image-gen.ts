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

import { put } from "@vercel/blob";
import { overlayHeadline } from "@/lib/poster-overlay";

// ─── Config ──────────────────────────────────────────────────────────────────

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL ?? "http://localhost:8188";
const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 120_000; // 2 minutes max

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
}

export interface GenerateImageResult {
  /** Vercel Blob URL (permanent) */
  url: string;
  /** Original filename from ComfyUI */
  filename: string;
  /** Generation seed used */
  seed: number;
}

/**
 * Generate an image using Flux Schnell (ComfyUI) and upload to Vercel Blob.
 * Returns the permanent public URL.
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
  const workflow = buildFluxWorkflow(prompt, seed, width, height);

  console.log(`[ImageGen] Submitting Flux prompt (${width}×${height}, seed=${seed})...`);
  const promptId = await submitPrompt(workflow);
  console.log(`[ImageGen] Prompt ID: ${promptId}, polling...`);

  const imageRef = await pollForResult(promptId);
  console.log(`[ImageGen] Generated: ${imageRef.filename}`);

  let imageBuffer = await fetchImage(imageRef.filename, imageRef.subfolder, imageRef.type);

  // Overlay the proofread headline as real text (clean, typo-free, on-brand).
  if (opts.overlayHeadline) {
    imageBuffer = await overlayHeadline(imageBuffer, opts.overlayHeadline);
  }

  // Upload to Vercel Blob
  const blobPath = `${blobPrefix}/${Date.now()}-${imageRef.filename}`;
  const { url } = await put(blobPath, imageBuffer, {
    access: "public",
    contentType: "image/png",
  });

  console.log(`[ImageGen] Uploaded to Vercel Blob: ${url}`);

  return { url, filename: imageRef.filename, seed };
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
