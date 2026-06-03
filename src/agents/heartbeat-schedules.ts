/**
 * Canonical heartbeat schedule matrix.
 *
 * Keep cadence in one place so agent configs, seed scripts, and docs do not
 * drift. The current defaults reduce advisory churn while preserving fast
 * guardian coverage.
 */

export const CEO_HEARTBEAT_CRON = "0 */12 * * *"; // Every 12 hours
export const COO_HEARTBEAT_CRON = "*/5 * * * *"; // Every 5 minutes
export const CMO_HEARTBEAT_CRON = "0 */8 * * *"; // Every 8 hours
export const CTO_HEARTBEAT_CRON = "*/15 * * * *"; // Every 15 minutes

export const COPYWRITER_HEARTBEAT_CRON = "0 5 * * *"; // Daily at 05:00 UTC
export const ADS_SPECIALIST_HEARTBEAT_CRON = "0 */8 * * *"; // Every 8 hours
export const SOCIAL_MEDIA_HEARTBEAT_CRON = "0 5 * * *"; // Daily at 05:00 UTC

export const OPPORTUNITY_SCOUT_HEARTBEAT_CRON = "0 4 * * 1"; // Monday 04:00 UTC
export const COMPETITOR_INTEL_HEARTBEAT_CRON = "0 4 * * 1"; // Monday 04:00 UTC

export const HEARTBEAT_INTERVAL_MINUTES: Record<string, number> = {
	ceo: 12 * 60,
	coo: 5,
	cmo: 8 * 60,
	cto: 15,
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