#!/usr/bin/env tsx
/**
 * LockSafe Mac Studio Agent Runner
 *
 * Standalone process that runs on the Mac Studio (M2 Ultra).
 * - Imports agent system directly (no HTTP hop, no Vercel)
 * - Calls Ollama on localhost:11434 — zero latency, zero token cost
 * - Runs every 5 minutes; each call to runAgentHeartbeats() is self-throttled
 *   by the nextHeartbeat DB field, so it's safe to call often
 * - PM2 keeps it alive and auto-restarts on crash
 *
 * Start:   pm2 start ecosystem.config.js
 * Logs:    pm2 logs locksafe-agents
 * Stop:    pm2 stop locksafe-agents
 */

// ─── Validate env before importing anything else ────────────────────────────
const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[agent-runner] ❌ Missing required env vars: ${missing.join(", ")}`);
  console.error("[agent-runner] Copy .env.agent-runner.example to .env.agent-runner and fill in values.");
  process.exit(1);
}

if (process.env.AGENTS_ENABLED !== "true") {
  console.error("[agent-runner] ❌ AGENTS_ENABLED is not 'true'. Set it in .env.agent-runner.");
  process.exit(1);
}

// ─── Imports ────────────────────────────────────────────────────────────────
import { initializeAgentSystem, runAgentHeartbeats } from "@/agents/index";
import { sendAdminAlert } from "@/lib/telegram";
import { generatePendingPostImages } from "@/lib/generate-post-images";
import { generatePendingPostVideos } from "@/lib/generate-post-videos";

// ─── Config ─────────────────────────────────────────────────────────────────
const TICK_INTERVAL_MS  = 5 * 60 * 1000;  // 5 minutes between ticks
const STARTUP_DELAY_MS  = 5_000;           // brief pause before first tick

let isRunning       = false;
let tickCount       = 0;
let lastTickAt: Date | null = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
let lastComfyAlertAt = 0; // throttle the "ComfyUI down" alert to ~hourly

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[agent-runner] ${new Date().toISOString()}  ${msg}`);
}

async function alertTelegram(msg: string, severity: "info" | "warning" | "error" = "info") {
  try {
    await sendAdminAlert({
      title: "🤖 Mac Studio Agent Runner",
      message: msg,
      severity,
      bypassPolicyGate: true,
    });
  } catch {
    // never crash due to Telegram failure
  }
}

// ─── Core tick ───────────────────────────────────────────────────────────────
async function tick() {
  if (isRunning) {
    log("⏭  Previous tick still running — skipping this interval.");
    return;
  }

  isRunning = true;
  tickCount++;
  lastTickAt = new Date();

  log(`🔄 Tick #${tickCount} — running agent heartbeats...`);

  try {
    const result = await runAgentHeartbeats();

    if (result.success) {
      log(
        `✅ Tick #${tickCount} done — ${result.agentsRun} agents, ` +
        `${result.totalActions} actions, $${result.totalCost.toFixed(4)} cost.`
      );
      consecutiveErrors = 0;
    } else {
      log(`⚠️  Tick #${tickCount} completed with errors: ${result.errors.join("; ")}`);
      consecutiveErrors++;
    }

    // Log per-agent results at debug level
    for (const r of result.results) {
      if (!r.success) {
        log(`   ↳ ${r.agentName}: FAILED — ${r.errors.join("; ")}`);
      }
    }

  } catch (err) {
    consecutiveErrors++;
    const msg = err instanceof Error ? err.message : String(err);
    log(`❌ Tick #${tickCount} threw: ${msg}`);

    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      const alert = `${consecutiveErrors} consecutive heartbeat failures.\nLast error: ${msg}\n\nRunner is still alive but agents may be stuck.`;
      log(`🚨 Alerting Telegram after ${consecutiveErrors} consecutive errors.`);
      await alertTelegram(`🚨 ${alert}`, "error");
      consecutiveErrors = 0; // reset so we don't spam Telegram every tick
    }
  }

  // ── Generate poster images for pending posts ────────────────────────────────
  // ComfyUI lives on this Mac (localhost), so this is the reliable place to run
  // image generation. Independent of agent heartbeats; degrades gracefully if
  // ComfyUI is down (returns { skipped }). Posts can't publish until they have
  // an imageUrl (publish paths are gated), so this is what keeps posters flowing.
  try {
    const img = await generatePendingPostImages({ limit: 5 });
    if (img.generated > 0) {
      log(`🎨 Generated ${img.generated} poster image(s)${img.usedFallback ? ` (${img.usedFallback} via OpenAI fallback)` : ""}.`);
      // Posters still flow via the cloud fallback, but it costs a little — nudge
      // to restart the free local ComfyUI. Throttled to once per hour.
      if (img.usedFallback > 0 && Date.now() - lastComfyAlertAt > 60 * 60 * 1000) {
        lastComfyAlertAt = Date.now();
        await alertTelegram(
          "🎨 ComfyUI appears DOWN — posters are being generated via the OpenAI fallback (small per-image cost).\n" +
          "Posting is unaffected, but restart ComfyUI (localhost:8188) to use the free local path.",
          "warning"
        );
      }
    } else if (img.skipped) {
      log(`🎨 Image gen skipped — ${img.reason}`);
    }
  } catch (err) {
    log(`⚠️  Image gen task error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── TikTok short-video generation (Mac runner only — needs ffmpeg) ──────────
  // Renders captioned 9:16 shorts with a TTS voiceover for TikTok-targeted posts
  // that still lack a videoUrl. Heavier than image gen, so a small limit. Posts
  // with a videoUrl are published as native TikTok video (preferred over photo).
  try {
    const vid = await generatePendingPostVideos({ limit: 2 });
    if (vid.generated > 0) {
      log(`🎬 Rendered ${vid.generated} TikTok short(s).`);
    } else if (vid.skipped) {
      log(`🎬 Short-video gen skipped — ${vid.reason}`);
    } else if (vid.failed > 0) {
      log(`🎬 Short-video gen: ${vid.failed} failed — ${vid.results.find((r) => !r.success)?.error}`);
    }
  } catch (err) {
    log(`⚠️  Short-video task error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isRunning = false;
  }
}

// ─── Status log every 30 minutes ─────────────────────────────────────────────
setInterval(() => {
  log(
    `📊 Status — uptime: ${Math.round(process.uptime() / 60)}m | ` +
    `ticks: ${tickCount} | last: ${lastTickAt?.toISOString() ?? "never"} | ` +
    `consecutive errors: ${consecutiveErrors}`
  );
}, 30 * 60 * 1000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  log(`🛑 Received ${signal}. Shutting down gracefully...`);
  await alertTelegram(`Agent runner stopped (${signal}) on Mac Studio.`, "warning");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("uncaughtException", async (err) => {
  log(`💥 Uncaught exception: ${err.message}`);
  await alertTelegram(`Uncaught exception in agent runner:\n${err.message}\n\nPM2 will restart the process.`, "error");
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  log(`💥 Unhandled rejection: ${msg}`);
  await alertTelegram(`Unhandled promise rejection:\n${msg}\n\nPM2 will restart the process.`, "error");
  process.exit(1);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function main() {
  log("========================================");
  log("  LockSafe Mac Studio Agent Runner");
  log("  Ollama: " + (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"));
  log("  Tick interval: " + (TICK_INTERVAL_MS / 1000 / 60) + " minutes");
  log("========================================");

  // Announce startup on Telegram
  await alertTelegram(
    `Agent runner started on Mac Studio.\nOllama: ${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}\nTick: every ${TICK_INTERVAL_MS / 60000} min`
  );

  // Initialize the full agent system (syncs DB state, registers tools, sets dependencies)
  log("Initializing agent system...");
  await initializeAgentSystem();

  // Small delay, then fire immediately on startup
  setTimeout(async () => {
    await tick();
    // Then run on the regular interval
    setInterval(tick, TICK_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  log(`✅ Scheduler running. First tick in ${STARTUP_DELAY_MS / 1000}s.`);
}

main().catch(async (err) => {
  log(`💥 Fatal startup error: ${err.message}`);
  await alertTelegram(`Agent runner failed to start:\n${err.message}`, "error");
  process.exit(1);
});
