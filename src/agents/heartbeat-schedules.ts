/**
 * Canonical heartbeat schedule matrix.
 *
 * Keep cadence in one place so agent configs, seed scripts, and docs do not
 * drift. The current defaults reduce advisory churn while preserving fast
 * guardian coverage.
 */

export const CEO_HEARTBEAT_CRON = "0 */12 * * *"; // Every 12 hours
export const COO_HEARTBEAT_CRON = "*/5 * * * *"; // Every 5 minutes (dispatch guardian — runs 24/7)
export const CMO_HEARTBEAT_CRON = "0 6,18 * * *"; // ~Every 12h, UK daytime only
export const CTO_HEARTBEAT_CRON = "0 6,12,18 * * *"; // ~Every 6h, UK daytime only
export const ENGINEER_HEARTBEAT_CRON = "0 7 * * *"; // Daily at 07:00 UTC (code-health triage)

export const COPYWRITER_HEARTBEAT_CRON = "0 5 * * *"; // Daily at 05:00 UTC
export const ADS_SPECIALIST_HEARTBEAT_CRON = "0 */8 * * *"; // Every 8 hours
export const SOCIAL_MEDIA_HEARTBEAT_CRON = "0 5 * * *"; // Daily at 05:00 UTC

export const OPPORTUNITY_SCOUT_HEARTBEAT_CRON = "0 4 * * 1"; // Monday 04:00 UTC
export const COMPETITOR_INTEL_HEARTBEAT_CRON = "0 4 * * 1"; // Monday 04:00 UTC

export const HEARTBEAT_INTERVAL_MINUTES: Record<string, number> = {
	ceo: 12 * 60,
	coo: 5,
	cmo: 12 * 60,
	cto: 6 * 60,
	engineer: 24 * 60,
	copywriter: 24 * 60,
	"ads-specialist": 8 * 60,
	"social-media": 24 * 60,
	"opportunity-scout": 7 * 24 * 60,
	"competitor-intel": 7 * 24 * 60,
};

export function getHeartbeatIntervalMinutes(agentId: string): number {
	return HEARTBEAT_INTERVAL_MINUTES[agentId.toLowerCase()] ?? 60;
}

export function getNextHeartbeatAt(agentId: string, from: Date = new Date()): Date {
	return new Date(from.getTime() + getHeartbeatIntervalMinutes(agentId) * 60_000);
}

// ─── Quiet hours & minimum-interval throttling ───────────────────────────────
//
// Quiet hours suppress agent heartbeats (and therefore their advisory Telegram
// alerts) overnight. Exempt agents — currently the COO dispatch guardian — keep
// running 24/7 so job-related notifications are never silenced.
//
// Times are evaluated in UK local time (Europe/London) so the window tracks
// BST/GMT automatically without manual offsets.

export const QUIET_HOURS_START_UK = 23; // inclusive — quiet begins at 23:00 UK
export const QUIET_HOURS_END_UK = 6;    // exclusive — quiet ends at 06:00 UK
export const QUIET_HOURS_TZ = "Europe/London";

// Agents that must keep running through quiet hours (job/dispatch critical).
export const QUIET_HOURS_EXEMPT_AGENTS = new Set<string>(["coo"]);

// Minimum spacing between heartbeats, enforced against the persisted
// lastHeartbeat. Lets us throttle chatty guardians (CTO, CMO) that otherwise
// run on every 5-minute cron cycle. Agents not listed here are unthrottled.
export const MIN_HEARTBEAT_INTERVAL_MINUTES: Record<string, number> = {
	cto: 6 * 60,  // at most every 6 hours
	cmo: 12 * 60, // at most every 12 hours
};

/** Current hour (0–23) in UK local time. */
export function getUkHour(now: Date = new Date()): number {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: QUIET_HOURS_TZ,
		hour: "numeric",
		hour12: false,
	}).formatToParts(now);
	const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
	const hour = parseInt(hourPart, 10);
	// Intl can emit "24" at midnight in some runtimes — normalise to 0.
	return hour === 24 ? 0 : hour;
}

/** True if `now` falls inside the UK quiet-hours window (handles wrap past midnight). */
export function isWithinQuietHours(now: Date = new Date()): boolean {
	const hour = getUkHour(now);
	if (QUIET_HOURS_START_UK <= QUIET_HOURS_END_UK) {
		return hour >= QUIET_HOURS_START_UK && hour < QUIET_HOURS_END_UK;
	}
	// Wraps midnight, e.g. 23 → 6
	return hour >= QUIET_HOURS_START_UK || hour < QUIET_HOURS_END_UK;
}

export function isQuietHoursExempt(agentId: string): boolean {
	return QUIET_HOURS_EXEMPT_AGENTS.has(agentId.toLowerCase());
}

/**
 * Decide whether an agent's heartbeat should be suppressed this cycle.
 *
 * Suppressed when:
 *  - it is quiet hours and the agent is not exempt, OR
 *  - the agent has a minimum interval and not enough time has elapsed since its
 *    last persisted heartbeat.
 *
 * Exempt agents (COO) are never suppressed.
 */
export function isHeartbeatSuppressed(
	agentId: string,
	lastHeartbeat: Date | null | undefined,
	now: Date = new Date(),
): { suppressed: boolean; reason?: "quiet-hours" | "min-interval" } {
	const id = agentId.toLowerCase();
	if (isQuietHoursExempt(id)) return { suppressed: false };

	if (isWithinQuietHours(now)) {
		return { suppressed: true, reason: "quiet-hours" };
	}

	const minInterval = MIN_HEARTBEAT_INTERVAL_MINUTES[id];
	if (minInterval && lastHeartbeat) {
		const elapsedMs = now.getTime() - new Date(lastHeartbeat).getTime();
		if (elapsedMs < minInterval * 60_000) {
			return { suppressed: true, reason: "min-interval" };
		}
	}

	return { suppressed: false };
}
