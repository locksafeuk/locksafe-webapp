/**
 * D-ID Talking Avatar Video Generation — LockSafe Social Media
 *
 * Generates short talking-head videos using D-ID's AI presenter API.
 * Best for: trust-signals, success-stories, engagement pillars where
 * a human face builds more credibility than a text-overlay video.
 *
 * The agent uses D-ID for high-trust pillars and Creatomate for the rest.
 *
 * Env:
 *   D_ID_API_KEY            — required; base64(email:key) from studio.d-id.com → API
 *   D_ID_PRESENTER_URL      — optional; URL of the presenter image to use
 *                             defaults to the LockSafe stock presenter
 *   D_ID_ENABLED            — optional; "false" to disable without removing key
 *   D_ID_VOICE_ID           — optional; Microsoft Azure voice ID (default: en-GB-RyanNeural)
 *
 * Pricing: ~1 credit per 15s video. 20 free credits on trial.
 *
 * Docs: https://docs.d-id.com/reference/createtalk
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TalkingVideoRequest {
  script: string;             // Text the avatar will speak (max ~400 chars for 30s)
  pillar: string;             // content pillar (for logging / routing)
  voiceId?: string;           // Azure voice ID override
  presenterUrl?: string;      // Presenter image URL override
  durationHint?: number;      // Rough target duration in seconds (informational only)
}

export interface TalkingVideoResult {
  url: string;                // Final rendered MP4 URL
  talkId: string;
  durationSeconds?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const D_ID_API_BASE = "https://api.d-id.com";
const POLL_INTERVAL_MS  = 3_000;
const POLL_MAX_ATTEMPTS = 40;  // 40 × 3s = 120s max

// Default UK male voice — professional, reassuring
const DEFAULT_VOICE_ID = "en-GB-RyanNeural";

// Default presenter — fetched live from D-ID's /presenters endpoint on first use.
// Override with a branded headshot via D_ID_PRESENTER_URL env var.
// D-ID's old DefaultPresenters URLs are deprecated as of 2025.
let _cachedPresenterUrl: string | null = null;

async function getPresenterUrl(auth: string): Promise<string> {
  // Env override always wins
  if (process.env.D_ID_PRESENTER_URL) return process.env.D_ID_PRESENTER_URL;

  // Return cached value after first successful fetch
  if (_cachedPresenterUrl) return _cachedPresenterUrl;

  try {
    const res = await fetch(`${D_ID_API_BASE}/presenters`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json() as { presenters?: Array<{ image_url?: string; preview_url?: string }> };
      const first = data.presenters?.[0];
      const url   = first?.image_url ?? first?.preview_url;
      if (url) {
        _cachedPresenterUrl = url;
        console.log(`[D-ID] Using presenter: ${url}`);
        return url;
      }
    }
  } catch {
    // fall through to static fallback
  }

  // Static fallback — a public domain headshot that D-ID accepts
  const fallback = "https://d-id-public-bucket.s3.us-east-1.amazonaws.com/alice.jpg";
  console.log(`[D-ID] Presenter list unavailable, using fallback: ${fallback}`);
  return fallback;
}

// Content pillars that benefit most from talking-head format
export const D_ID_PREFERRED_PILLARS = new Set([
  "trust-signals",
  "success-stories",
  "engagement",
]);

// ─── Script Templates ─────────────────────────────────────────────────────────
// Pre-built intros matched to each pillar. The agent appends its generated
// content after these openers. Keeps videos under 30s (trial limit safe).

export const PILLAR_SCRIPT_INTRO: Record<string, string> = {
  "trust-signals":
    "Hi, I'm here from LockSafe UK — the platform that connects you with vetted, trusted local locksmiths. ",
  "success-stories":
    "Every day, LockSafe locksmiths are helping people across the UK. Here's one of today's stories. ",
  "engagement":
    "Quick question for you — and I'd love to hear what you think. ",
  "security-tips":
    "Here's a quick security tip from the LockSafe team. ",
  "behind-scenes":
    "Let me give you a quick look behind the scenes at how LockSafe works. ",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAuthHeader(): string {
  const key = process.env.D_ID_API_KEY ?? "";

  // D-ID displays keys in the Studio as: base64(email):apikey
  // Their API docs say to use that string directly as the Basic auth value.
  // i.e.  Authorization: Basic <the-key-as-shown-in-studio>
  // The key is already in the correct format — no further encoding needed.
  //
  // If the key contains a colon it is in the studio display format.
  // If it is a raw base64 string (no colon) it can be used directly too.
  return `Basic ${key}`;
}

function buildScript(req: TalkingVideoRequest): string {
  const intro = PILLAR_SCRIPT_INTRO[req.pillar] ?? "";
  const body  = req.script.trim();
  // Keep total script under ~380 chars to stay within ~30s at natural pace
  const full  = (intro + body).trim();
  return full.length > 380 ? full.slice(0, 377) + "..." : full;
}

// ─── Poll for completion ──────────────────────────────────────────────────────

async function pollUntilDone(talkId: string): Promise<string> {
  const auth = getAuthHeader();

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${D_ID_API_BASE}/talks/${talkId}`, {
      headers: { Authorization: auth, Accept: "application/json" },
    });

    if (!res.ok) throw new Error(`D-ID poll error ${res.status}`);

    const data = await res.json() as {
      status: string;
      result_url?: string;
      error?: { description: string };
    };

    if (data.status === "done" && data.result_url) return data.result_url;
    if (data.status === "error") {
      throw new Error(`D-ID render failed: ${data.error?.description ?? "unknown"}`);
    }
    // status: "created" | "started" | "processing" → keep polling
  }

  throw new Error("D-ID render timed out after 120s");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a talking-head video using D-ID.
 *
 * Returns null (never throws) when:
 *  - D_ID_API_KEY is not set
 *  - D_ID_ENABLED=false
 *  - Any render / network error
 *
 * The social post is always created regardless — video is a bonus.
 */
export async function generateTalkingVideo(
  req: TalkingVideoRequest
): Promise<TalkingVideoResult | null> {
  const apiKey = process.env.D_ID_API_KEY;
  if (!apiKey) {
    console.log("[D-ID] D_ID_API_KEY not set — skipping talking video");
    return null;
  }

  if (process.env.D_ID_ENABLED === "false") {
    console.log("[D-ID] Disabled via D_ID_ENABLED=false");
    return null;
  }

  const auth        = getAuthHeader();
  const presenterUrl = req.presenterUrl ?? await getPresenterUrl(auth);
  const voiceId      = req.voiceId ?? process.env.D_ID_VOICE_ID ?? DEFAULT_VOICE_ID;
  const scriptText   = buildScript(req);

  try {
    console.log(`[D-ID] Creating talking video for pillar: ${req.pillar}`);
    console.log(`[D-ID] Presenter: ${presenterUrl}`);
    console.log(`[D-ID] Script (${scriptText.length} chars): "${scriptText.slice(0, 60)}..."`);

    const res = await fetch(`${D_ID_API_BASE}/talks`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        source_url: presenterUrl,
        script: {
          type: "text",
          input: scriptText,
          provider: {
            type: "microsoft",
            voice_id: voiceId,
          },
        },
        config: {
          fluent: true,
          pad_audio: 0.0,
          stitch: true,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`D-ID submit error ${res.status}: ${err}`);
    }

    const data = await res.json() as { id: string; status: string; result_url?: string };
    const talkId = data.id;

    // If already done (cached)
    const url = data.result_url ?? await pollUntilDone(talkId);

    console.log(`[D-ID] ✅ Talking video ready: ${url}`);
    return { url, talkId };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[D-ID] ⚠️  Talking video failed (non-fatal): ${msg}`);
    return null;
  }
}

/**
 * Decide whether D-ID or Creatomate is the better choice for a given pillar.
 * Returns "d-id" for high-trust pillars, "creatomate" for everything else.
 */
export function preferredVideoProvider(pillar: string): "d-id" | "creatomate" {
  return D_ID_PREFERRED_PILLARS.has(pillar) ? "d-id" : "creatomate";
}
