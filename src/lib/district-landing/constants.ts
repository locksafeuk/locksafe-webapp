/**
 * Lightweight district-landing constants — ZERO heavy dependencies.
 *
 * This module is deliberately dependency-free so that read-only consumers
 * (e.g. the admin coverage dashboard at /admin/seo/coverage) can import a
 * single configuration value WITHOUT transitively pulling in the
 * content-generation stack (`ensure-landing` → `generate-content` →
 * `llm-router` / Ollama / OpenAI clients).
 *
 * Importing the generation stack into a read page bloats the server bundle
 * and couples a simple dashboard render to the LLM runtime — which is the
 * kind of coupling that previously made the coverage route fragile.
 */

/**
 * Default regeneration cadence for AI-generated district landing pages.
 * Pages older than this get refreshed by the next `ensureDistrictLanding()`
 * call. Manual overrides are never regenerated.
 *
 * 90 days ≈ one quarter — long enough for local conditions to shift
 * (roster changes, coverage radius) but short enough to keep Google's
 * freshness signal positive.
 */
export const REGENERATE_AFTER_DAYS = Number(
  process.env["DISTRICT_LANDING_REGENERATE_DAYS"] ?? "90",
);
