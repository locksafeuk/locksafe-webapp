/**
 * Veo b-roll generator (Google Gemini API) — TypeScript port of the Python
 * `ai_video_generator.py` flow, focused on producing ONE short, silent,
 * brand-coherent background clip for the short-video engine.
 *
 * Defaults to **Veo 3.1 Lite** (`veo-3.1-lite-generate-preview`, ~$0.03–0.05/s)
 * — the cheapest tier — with NO audio (our OpenAI TTS provides the voiceover)
 * and NO identifiable faces. The clip is looped under the captions as a moving
 * background, so a short 6s clip covers a 20s short.
 *
 * REST (not the SDK) so there's no extra dependency: `:predictLongRunning` →
 * poll the operation → download the file. Every failure is the caller's cue to
 * fall back to the free gradient/poster background — Veo is best-effort.
 *
 * Mac-runner only (same as the rest of short-video). Requires GEMINI_API_KEY.
 */

import { writeFile } from "node:fs/promises";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Brand visual lexicon — kept in sync with ai_video_generator.py BRAND_VISUAL_STYLE. */
const BRAND_VISUAL_STYLE =
  "Cinematic UK locksmith brand video. " +
  "Colour grade: deep navy and warm gold accent lighting. " +
  "Real British setting (terraced houses, brick, UK street furniture). " +
  "Professional, calm, trustworthy mood. Anamorphic look, shallow depth of field. " +
  "Slow, smooth camera motion. " +
  "No on-screen text, no logos, no readable signage. No identifiable faces.";

export interface VeoModelInfo {
  model: string;
  costPerSecondUsd: number;
}

/** Resolved model + price (env-overridable; Veo names/prices drift). */
export function veoModel(): VeoModelInfo {
  return {
    model: process.env.LOCKSAFE_VEO_MODEL || "veo-3.1-lite-generate-preview",
    costPerSecondUsd: Number(process.env.LOCKSAFE_VEO_COST_PER_SEC || "0.05"),
  };
}

export function isVeoConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Build a text-free, face-free b-roll prompt from a post's theme. The captions
 * carry all the words; the clip is pure atmosphere.
 */
export function brollPrompt(theme: string): string {
  const subject = (theme || "a trusted UK locksmith securing a front door at dusk")
    .replace(/["\n]+/g, " ")
    .trim()
    .slice(0, 200);
  return `${BRAND_VISUAL_STYLE} Scene: ${subject}.`;
}

interface VeoOperation {
  name?: string;
  done?: boolean;
  error?: { code?: number; message?: string };
  response?: Record<string, unknown>;
}

/** Dig the downloadable video URI / inline bytes out of a finished operation (shape-tolerant). */
function extractVideo(op: VeoOperation): { uri?: string; b64?: string } | null {
  const resp = op.response as Record<string, unknown> | undefined;
  if (!resp) return null;
  // Common shapes across Veo API revisions.
  const candidates: unknown[] = [
    (resp.generateVideoResponse as Record<string, unknown> | undefined)?.generatedSamples,
    (resp.generateVideoResponse as Record<string, unknown> | undefined)?.generatedVideos,
    resp.generatedSamples,
    resp.generatedVideos,
    resp.videos,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      const first = c[0] as Record<string, unknown>;
      const video = (first.video as Record<string, unknown>) || first;
      const uri = (video.uri as string) || (video.videoUri as string);
      const b64 = (video.bytesBase64Encoded as string) || (video.videoBytes as string);
      if (uri || b64) return { uri, b64 };
    }
  }
  return null;
}

/**
 * Generate one b-roll clip and write it to `outPath` (mp4). Returns the resolved
 * model + estimated cost so the caller can record spend. Throws on any failure
 * (caller falls back to the free background).
 */
export async function generateBrollClip(params: {
  prompt: string;
  outPath: string;
  aspectRatio?: "9:16" | "1:1" | "16:9";
  durationSeconds?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<{ outPath: string; model: string; durationSeconds: number; estCostUsd: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const { model, costPerSecondUsd } = veoModel();
  const aspectRatio = params.aspectRatio ?? "9:16";
  const durationSeconds = params.durationSeconds ?? Number(process.env.LOCKSAFE_VEO_CLIP_SECONDS || "6");
  // Veo 3.1 Lite (text-to-video) rejects the personGeneration values that other
  // Veo models accept, so we OMIT it by default and let the model decide. Only
  // sent if explicitly configured. Faces are discouraged via the prompt anyway.
  const personGeneration = process.env.LOCKSAFE_VEO_PEOPLE || "";
  const pollIntervalMs = params.pollIntervalMs ?? 15_000;
  const timeoutMs = params.timeoutMs ?? 300_000;

  // 1) Kick off the long-running prediction.
  const startRes = await fetch(`${GEMINI_BASE}/models/${model}:predictLongRunning?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: params.prompt }],
      parameters: {
        aspectRatio,
        durationSeconds,
        sampleCount: 1,
        // personGeneration only sent if explicitly configured (see above).
        ...(personGeneration ? { personGeneration } : {}),
        // NB: Veo 3.1 Lite has no audio track (and rejects `generateAudio`), which
        // is exactly what we want — our OpenAI TTS provides the voiceover.
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!startRes.ok) {
    throw new Error(`Veo start ${startRes.status}: ${(await startRes.text()).slice(0, 200)}`);
  }
  const startJson = (await startRes.json()) as VeoOperation;
  const opName = startJson.name;
  if (!opName) throw new Error("Veo returned no operation name");

  // 2) Poll until done (or timeout).
  const deadline = Date.now() + timeoutMs;
  let op: VeoOperation = startJson;
  while (!op.done) {
    if (Date.now() > deadline) throw new Error(`Veo timed out after ${timeoutMs / 1000}s`);
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const pollRes = await fetch(`${GEMINI_BASE}/${opName}?key=${apiKey}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!pollRes.ok) continue; // transient — keep polling
    op = (await pollRes.json()) as VeoOperation;
    if (op.error) throw new Error(`Veo op error ${op.error.code}: ${op.error.message}`);
  }

  // 3) Resolve + download the video.
  const vid = extractVideo(op);
  if (!vid) throw new Error("Veo finished but returned no video");

  let bytes: Buffer;
  if (vid.b64) {
    bytes = Buffer.from(vid.b64, "base64");
  } else if (vid.uri) {
    // The file URI needs the API key to download.
    const sep = vid.uri.includes("?") ? "&" : "?";
    const dl = await fetch(`${vid.uri}${sep}key=${apiKey}`, { signal: AbortSignal.timeout(120_000) });
    if (!dl.ok) throw new Error(`Veo download ${dl.status}`);
    bytes = Buffer.from(await dl.arrayBuffer());
  } else {
    throw new Error("Veo video had neither uri nor bytes");
  }

  await writeFile(params.outPath, bytes);
  return { outPath: params.outPath, model, durationSeconds, estCostUsd: durationSeconds * costPerSecondUsd };
}
