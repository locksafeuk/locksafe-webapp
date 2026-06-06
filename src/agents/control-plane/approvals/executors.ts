/**
 * Risky-action executors — what actually runs when an approval is GRANTED.
 *
 * Only actions with a registered executor here are auto-fulfilled on approval.
 * Actions without one are approved but flagged for manual fulfilment (so nothing
 * silently no-ops). Add executors as each risky tool is migrated onto the spine.
 *
 * First wired: agent.pause / agent.resume (self-contained, already in orchestrator).
 */

import { pauseAgent, resumeAgent } from "@/agents/core/orchestrator";
import { InMemoryExecutorRegistry } from "../adapters/memory";
import type { ExecutorRegistry } from "../ports";

export function buildRiskyExecutorRegistry(): ExecutorRegistry {
  return new InMemoryExecutorRegistry()
    .register("agent.pause", async (args) => {
      const name = String((args as { agentName?: string })?.agentName ?? "");
      if (!name) return { ok: false, message: "agent.pause: missing agentName" };
      const ok = await pauseAgent(name);
      return { ok, message: ok ? `Paused ${name}` : `Failed to pause ${name}` };
    })
    .register("agent.resume", async (args) => {
      const name = String((args as { agentName?: string })?.agentName ?? "");
      if (!name) return { ok: false, message: "agent.resume: missing agentName" };
      const ok = await resumeAgent(name);
      return { ok, message: ok ? `Resumed ${name}` : `Failed to resume ${name}` };
    });
}
