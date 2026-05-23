import { runLLMFailoverHealthCheck } from "../src/lib/llm-failover-health";

async function main() {
  const result = await runLLMFailoverHealthCheck();
  console.log(JSON.stringify(result, null, 2));

  if (result.status === "unhealthy") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[check-llm-failover] fatal:", (err as Error)?.message);
  process.exitCode = 1;
});
