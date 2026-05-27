/**
 * Creatomate Video Generation — LockSafe Social Media
 *
 * Generates short-form branded videos for social media posts.
 * Called by the SocialMedia agent after text content is generated.
 *
 * No pre-built templates required — compositions are defined entirely in JSON
 * and sent to Creatomate's render API. The API key is the only requirement.
 *
 * Formats produced:
 *   - 9:16 vertical (1080×1920) — Instagram Reels, TikTok, Facebook Reels
 *   - 1:1 square (1080×1080)   — Facebook Feed, LinkedIn
 *
 * Env:
 *   CREATOMATE_API_KEY  — required; get from app.creatomate.com → API
 *   CREATOMATE_ENABLED  — optional; "false" to disable without removing key
 *
 * Pricing: ~1 credit per render. 50 free credits on trial.
 *
 * Docs: https://creatomate.com/docs/api/introduction
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoFormat = "vertical" | "square";

export interface VideoRequest {
  headline: string;           // Large central text
  subtext?: string;           // Smaller supporting text (optional)
  cta?: string;               // Call to action line (default: locksafe.uk)
  pillar: string;             // content pillar — drives colour scheme
  format?: VideoFormat;       // default: "vertical"
  durationSeconds?: number;   // default: 15
}

export interface VideoResult {
  url: string;               // Final rendered MP4 URL (CDN-hosted)
  renderId: string;
  format: VideoFormat;
  durationSeconds: number;
}

// ─── Brand Palette ────────────────────────────────────────────────────────────
// Maps content pillars to background gradients

const PILLAR_COLOURS: Record<string, { from: string; to: string; accent: string }> = {
  "security-tips":   { from: "#0F1C2E", to: "#1A3A5C", accent: "#3B9EFF" },
  "success-stories": { from: "#0D2818", to: "#1A4A2E", accent: "#2ECC71" },
  "trust-signals":   { from: "#1A0A2E", to: "#2D1B4E", accent: "#9B59B6" },
  "behind-scenes":   { from: "#1C1200", to: "#3D2A00", accent: "#F39C12" },
  "engagement":      { from: "#1A0A0A", to: "#3D1414", accent: "#E74C3C" },
  "default":         { from: "#0F1C2E", to: "#1A3A5C", accent: "#3B9EFF" },
};

// ─── Composition Builder ──────────────────────────────────────────────────────

function buildComposition(req: VideoRequest): object {
  const format = req.format ?? "vertical";
  const duration = req.durationSeconds ?? 15;
  const colours = PILLAR_COLOURS[req.pillar] ?? PILLAR_COLOURS["default"];
  const cta = req.cta ?? "locksafe.uk";

  const width  = format === "vertical" ? 1080 : 1080;
  const height = format === "vertical" ? 1920 : 1080;

  // Responsive font sizes
  const headlineFontSize = format === "vertical"
    ? (req.headline.length > 60 ? "68px" : "82px")
    : (req.headline.length > 60 ? "56px" : "68px");

  return {
    output_format: "mp4",
    width,
    height,
    duration,
    frame_rate: 30,
    elements: [
      // ── Background gradient ───────────────────────────────────────────────
      {
        id: "bg",
        type: "shape",
        shape: "rectangle",
        x: "50%",
        y: "50%",
        width: "100%",
        height: "100%",
        fill_color: colours.from,
        animations: [
          {
            time: 0,
            duration: duration,
            easing: "linear",
            type: "color-change",
            start_color: colours.from,
            end_color: colours.to,
          },
        ],
      },

      // ── Accent bar (top) ──────────────────────────────────────────────────
      {
        id: "accent_bar",
        type: "shape",
        shape: "rectangle",
        x: "50%",
        y: format === "vertical" ? "5%" : "4%",
        width: "15%",
        height: "6px",
        fill_color: colours.accent,
        animations: [
          { time: 0.3, duration: 0.6, easing: "ease-out", type: "slide", direction: "down" },
        ],
      },

      // ── Logo / Brand name ─────────────────────────────────────────────────
      {
        id: "logo",
        type: "text",
        text: "🔒 LockSafe UK",
        x: "50%",
        y: format === "vertical" ? "8%" : "10%",
        width: "80%",
        font_family: "Montserrat",
        font_weight: "700",
        font_size: "34px",
        fill_color: "#FFFFFF",
        x_alignment: "50%",
        animations: [
          { time: 0.2, duration: 0.5, easing: "ease-out", type: "fade" },
        ],
      },

      // ── Headline ──────────────────────────────────────────────────────────
      {
        id: "headline",
        type: "text",
        text: req.headline,
        x: "50%",
        y: "50%",
        width: "82%",
        font_family: "Montserrat",
        font_weight: "800",
        font_size: headlineFontSize,
        fill_color: "#FFFFFF",
        x_alignment: "50%",
        y_alignment: "50%",
        line_height: "1.2em",
        animations: [
          {
            time: 0.6,
            duration: 0.7,
            easing: "ease-out",
            type: "slide",
            direction: "up",
            fade: true,
          },
        ],
      },

      // ── Subtext (optional) ────────────────────────────────────────────────
      ...(req.subtext
        ? [
            {
              id: "subtext",
              type: "text",
              text: req.subtext,
              x: "50%",
              y: format === "vertical" ? "65%" : "68%",
              width: "78%",
              font_family: "Montserrat",
              font_weight: "400",
              font_size: "32px",
              fill_color: "rgba(255,255,255,0.82)",
              x_alignment: "50%",
              line_height: "1.4em",
              animations: [
                {
                  time: 1.0,
                  duration: 0.6,
                  easing: "ease-out",
                  type: "fade",
                },
              ],
            },
          ]
        : []),

      // ── Accent bar (bottom) ───────────────────────────────────────────────
      {
        id: "accent_bar_bottom",
        type: "shape",
        shape: "rectangle",
        x: "50%",
        y: format === "vertical" ? "88%" : "88%",
        width: "80%",
        height: "2px",
        fill_color: `${colours.accent}66`,
        animations: [
          { time: 1.2, duration: 0.5, easing: "ease-out", type: "wipe", direction: "right" },
        ],
      },

      // ── CTA ───────────────────────────────────────────────────────────────
      {
        id: "cta",
        type: "text",
        text: cta,
        x: "50%",
        y: format === "vertical" ? "92%" : "93%",
        width: "80%",
        font_family: "Montserrat",
        font_weight: "600",
        font_size: "28px",
        fill_color: colours.accent,
        x_alignment: "50%",
        animations: [
          { time: 1.4, duration: 0.6, easing: "ease-out", type: "fade" },
        ],
      },
    ],
  };
}

// ─── Render API ───────────────────────────────────────────────────────────────

const CREATOMATE_API_URL = "https://api.creatomate.com/v1/renders";
const POLL_INTERVAL_MS   = 3_000;
const POLL_MAX_ATTEMPTS  = 40; // 40 × 3s = 120s max wait

async function pollUntilDone(renderId: string, apiKey: string): Promise<string> {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${CREATOMATE_API_URL}/${renderId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) throw new Error(`Creatomate poll error ${res.status}`);
    const data = await res.json() as { status: string; url?: string; error_message?: string };

    if (data.status === "succeeded" && data.url) return data.url;
    if (data.status === "failed") throw new Error(`Render failed: ${data.error_message ?? "unknown"}`);
    // status === "planned" | "rendering" → keep polling
  }
  throw new Error("Creatomate render timed out after 120s");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a short branded video for a social post.
 *
 * Returns null (instead of throwing) if:
 *  - CREATOMATE_API_KEY is not set
 *  - CREATOMATE_ENABLED=false
 *  - Any render/network error (so the agent heartbeat never fails due to video)
 */
export async function generateSocialVideo(req: VideoRequest): Promise<VideoResult | null> {
  const apiKey = process.env.CREATOMATE_API_KEY;
  if (!apiKey) {
    console.log("[Creatomate] CREATOMATE_API_KEY not set — skipping video generation");
    return null;
  }

  if (process.env.CREATOMATE_ENABLED === "false") {
    console.log("[Creatomate] Disabled via CREATOMATE_ENABLED=false");
    return null;
  }

  const format   = req.format ?? "vertical";
  const duration = req.durationSeconds ?? 15;

  try {
    console.log(`[Creatomate] Rendering ${format} video: "${req.headline.slice(0, 50)}..."`);

    const composition = buildComposition(req);

    const res = await fetch(CREATOMATE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ source: composition }]),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Creatomate submit error ${res.status}: ${err}`);
    }

    const renders = await res.json() as Array<{ id: string; status: string; url?: string }>;
    const render  = renders[0];
    if (!render) throw new Error("Creatomate returned empty renders array");

    // If already done (rare but possible for cached renders)
    const url = render.url ?? await pollUntilDone(render.id, apiKey);

    console.log(`[Creatomate] ✅ Video ready: ${url}`);
    return { url, renderId: render.id, format, durationSeconds: duration };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Creatomate] ⚠️  Video generation failed (non-fatal): ${msg}`);
    return null; // non-fatal — post is still created without video
  }
}

/**
 * Generate both vertical (Reels/TikTok) and square (Feed) versions.
 * Returns whichever succeed; gracefully skips on errors.
 */
export async function generateSocialVideoSet(req: Omit<VideoRequest, "format">): Promise<{
  vertical: VideoResult | null;
  square: VideoResult | null;
}> {
  const [vertical, square] = await Promise.all([
    generateSocialVideo({ ...req, format: "vertical" }),
    generateSocialVideo({ ...req, format: "square" }),
  ]);
  return { vertical, square };
}
