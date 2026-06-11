#!/usr/bin/env node
/**
 * set-retell-model.cjs
 * ---------------------------------------------------------------------------
 * Inspect (and optionally switch) the LLM model behind the Retell voice
 * receptionist. The Retell agent's model lives in the Retell dashboard / API,
 * NOT in the repo — this script reaches the Retell API directly using
 * RETELL_API_KEY from .env.
 *
 * Cost note: gpt-4o is ~16x the price of gpt-4o-mini. For a voice receptionist
 * mini is usually plenty and keeps per-minute LLM cost down.
 *
 * USAGE
 *   node scripts/set-retell-model.cjs                 # inspect only (no changes)
 *   node scripts/set-retell-model.cjs --apply         # switch to gpt-4o-mini
 *   node scripts/set-retell-model.cjs --apply --model gpt-4o-mini
 *
 * By default --apply only touches the LLM attached to RETELL_AGENT_ID.
 * Add --all to apply to every retell-llm on the account.
 * ---------------------------------------------------------------------------
 */
require("dotenv").config();
const { Retell } = require("retell-sdk");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const ALL = args.includes("--all");
const modelIdx = args.indexOf("--model");
const TARGET_MODEL = modelIdx !== -1 ? args[modelIdx + 1] : "gpt-4o-mini";

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error("✗ RETELL_API_KEY is missing from .env");
    process.exit(1);
  }
  const client = new Retell({ apiKey });
  const agentId = process.env.RETELL_AGENT_ID;

  // Resolve which llm_id the live agent uses. (llm.list() is unreliable and
  // often returns [], so we go straight from the agent to llm.retrieve.)
  let liveLlmId = null;
  if (agentId) {
    try {
      const agent = await client.agent.retrieve(agentId);
      if (agent?.response_engine?.type === "retell-llm") {
        liveLlmId = agent.response_engine.llm_id;
      }
      console.log(`Live agent: ${agentId} (${agent?.agent_name ?? "—"}) → llm_id: ${liveLlmId ?? "n/a"}\n`);
    } catch (e) {
      console.warn(`! Could not retrieve RETELL_AGENT_ID=${agentId}: ${e.message}\n`);
    }
  }

  if (!liveLlmId) {
    console.error("✗ No retell-llm id resolved from the agent. Is RETELL_AGENT_ID set and a retell-llm agent?");
    process.exit(1);
  }

  // Retrieve the live LLM directly by id.
  const llm = await client.llm.retrieve(liveLlmId);
  console.log(`Current receptionist LLM:\n  ${llm.llm_id} | model: ${llm.model ?? "—"} | temp: ${llm.model_temperature ?? "—"}\n`);

  if (!APPLY) {
    console.log(`Dry run. Re-run with --apply to switch the receptionist to "${TARGET_MODEL}".`);
    return;
  }

  if (llm.model === TARGET_MODEL) {
    console.log(`= Already on ${TARGET_MODEL}, nothing to do.`);
    return;
  }

  await client.llm.update(liveLlmId, { model: TARGET_MODEL });
  console.log(`✓ ${liveLlmId}: ${llm.model ?? "—"} → ${TARGET_MODEL}`);
  console.log("\nDone. New calls will use the updated model.");
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
