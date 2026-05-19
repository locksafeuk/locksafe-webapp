export type CheckStatus = "PASS" | "WARN" | "FAIL";

export interface CheckResult {
  id: string;
  category: "code" | "website" | "workflow" | "agents" | "integrations";
  name: string;
  critical: boolean;
  status: CheckStatus;
  httpStatus?: number;
  details: string;
}

export interface ReliabilityScore {
  score: number;
  overall: "GREEN" | "AMBER" | "RED";
  pass: number;
  warn: number;
  fail: number;
}

export interface ReliabilityReport {
  timestamp: string;
  baseUrl: string;
  score: ReliabilityScore;
  results: CheckResult[];
}

interface JsonMap {
  [key: string]: unknown;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl || "https://www.locksafe.uk").replace(/\/$/, "");
}

function endpoint(baseUrl: string, pathname: string): string {
  return `${baseUrl}${pathname}`;
}

async function requestJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: JsonMap | null; text: string }> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let body: JsonMap | null = null;
  try {
    body = JSON.parse(text) as JsonMap;
  } catch {
    body = null;
  }

  return { ok: res.ok, status: res.status, body, text };
}

function toStatus(pass: boolean, warn = false): CheckStatus {
  if (pass) return "PASS";
  if (warn) return "WARN";
  return "FAIL";
}

export async function runDailyReliabilityChecks(options?: {
  baseUrl?: string;
  ollamaBaseUrl?: string;
  staleHeartbeatMinutes?: number;
}): Promise<ReliabilityReport> {
  const baseUrl = normalizeBaseUrl(options?.baseUrl);
  const staleThresholdMins = options?.staleHeartbeatMinutes ?? 30;
  const results: CheckResult[] = [];

  // 1) Website reachability
  const homepage = await requestJson(endpoint(baseUrl, "/"), { method: "GET" });
  results.push({
    id: "website_home",
    category: "website",
    name: "Homepage reachable",
    critical: true,
    status: toStatus(homepage.status === 200),
    httpStatus: homepage.status,
    details: homepage.status === 200 ? "Homepage returned 200" : `Expected 200, got ${homepage.status}`,
  });

  const adminPage = await requestJson(endpoint(baseUrl, "/admin/agents"), { method: "GET" });
  results.push({
    id: "website_admin",
    category: "website",
    name: "Admin agents page reachable",
    critical: true,
    status: toStatus(adminPage.status === 200),
    httpStatus: adminPage.status,
    details: adminPage.status === 200 ? "Admin page returned 200" : `Expected 200, got ${adminPage.status}`,
  });

  // 2) Core health
  const health = await requestJson(endpoint(baseUrl, "/api/health"), { method: "GET" });
  const healthBody = health.body || {};
  const healthStatus = String((healthBody.status as string) || "unknown");
  const checks = (healthBody.checks as JsonMap) || {};
  const dbCheck = (checks.database as JsonMap) || {};
  const dbOk = dbCheck.status === "ok";
  const healthGood = health.status === 200 && dbOk && (healthStatus === "healthy" || healthStatus === "degraded");
  results.push({
    id: "api_health",
    category: "code",
    name: "API health endpoint and DB connectivity",
    critical: true,
    status: toStatus(healthGood),
    httpStatus: health.status,
    details: `health=${healthStatus}, database=${String(dbCheck.status || "unknown")}`,
  });

  // 3) Workflow endpoints — send minimal valid payloads so the validators accept them
  const dailyVisitorId = `daily-reliability-${Date.now()}`;
  const marketingSession = await requestJson(endpoint(baseUrl, "/api/marketing/session"), {
    method: "POST",
    body: JSON.stringify({
      visitorId: dailyVisitorId,
      landingPage: "/",
      referrer: "",
      userAgent: "locksafe-daily-reliability/1.0",
    }),
  });
  const sessionPass = marketingSession.status === 200;
  const sessionWarn = marketingSession.status >= 400 && marketingSession.status < 500;
  const sessionBody = marketingSession.body || {};
  const sessionObj = (sessionBody.session as JsonMap) || {};
  const createdSessionId = typeof sessionObj.id === "string" ? sessionObj.id : "";
  results.push({
    id: "workflow_marketing_session",
    category: "workflow",
    name: "Marketing session endpoint",
    critical: false,
    status: toStatus(sessionPass, sessionWarn),
    httpStatus: marketingSession.status,
    details:
      marketingSession.status === 200
        ? "Session tracking accepted"
        : marketingSession.status >= 400 && marketingSession.status < 500
          ? `Endpoint reachable but request validation rejected (${marketingSession.status})`
          : `Expected 200, got ${marketingSession.status}`,
  });

  const marketingTrack = await requestJson(endpoint(baseUrl, "/api/marketing/track"), {
    method: "POST",
    body: JSON.stringify({
      type: "event",
      sessionId: createdSessionId || dailyVisitorId,
      eventType: "daily_reliability_ping",
      element: "daily-reliability-check",
      eventData: { source: "daily-reliability-check" },
    }),
  });
  const trackPass = marketingTrack.status === 200;
  const trackWarn = marketingTrack.status >= 400 && marketingTrack.status < 500;
  results.push({
    id: "workflow_marketing_track",
    category: "workflow",
    name: "Marketing track endpoint",
    critical: false,
    status: toStatus(trackPass, trackWarn),
    httpStatus: marketingTrack.status,
    details:
      marketingTrack.status === 200
        ? "Event tracking accepted"
        : marketingTrack.status >= 400 && marketingTrack.status < 500
          ? `Endpoint reachable but request validation rejected (${marketingTrack.status})`
          : `Expected 200, got ${marketingTrack.status}`,
  });

  const locksmiths = await requestJson(endpoint(baseUrl, "/api/locksmiths"), { method: "GET" });
  results.push({
    id: "workflow_locksmiths",
    category: "workflow",
    name: "Public locksmith listing endpoint",
    critical: true,
    status: toStatus(locksmiths.status === 200),
    httpStatus: locksmiths.status,
    details: locksmiths.status === 200 ? "Locksmith listing available" : `Expected 200, got ${locksmiths.status}`,
  });

  // 4) Agents and tasks health (cron-authenticated to bypass admin-cookie gate)
  const cronAuthHeaders: Record<string, string> = process.env.CRON_SECRET
    ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
    : {};
  const agents = await requestJson(endpoint(baseUrl, "/api/agents"), {
    method: "GET",
    headers: cronAuthHeaders,
  });
  const agentsBody = agents.body || {};
  const agentList = (agentsBody.agents as Array<JsonMap>) || [];
  const activeAgents = agentList.filter((a) => a.status === "active");
  const staleAgents = activeAgents.filter((a) => {
    const hb = a.lastHeartbeat as string | null;
    if (!hb) return true;
    const mins = (Date.now() - new Date(hb).getTime()) / 60000;
    return mins > staleThresholdMins;
  });

  const agentsPass = agents.status === 200 && activeAgents.length > 0;
  const agentsWarn = agentsPass && staleAgents.length > 0;
  results.push({
    id: "agents_overview",
    category: "agents",
    name: "Agents API and heartbeat freshness",
    critical: true,
    status: toStatus(agentsPass && staleAgents.length === 0, agentsWarn),
    httpStatus: agents.status,
    details: `active=${activeAgents.length}, stale>${staleThresholdMins}m=${staleAgents.length}`,
  });

  const tasks = await requestJson(endpoint(baseUrl, "/api/agents/tasks"), {
    method: "GET",
    headers: cronAuthHeaders,
  });
  const tasksBody = tasks.body || {};
  const summary = (tasksBody.summary as JsonMap) || {};
  const pending = Number(summary.pending || 0);
  const inProgress = Number(summary.inProgress || 0);
  const overload = pending > 30;
  results.push({
    id: "agents_tasks_queue",
    category: "agents",
    name: "Agents task queue load",
    critical: false,
    status: toStatus(tasks.status === 200 && !overload, tasks.status === 200 && overload),
    httpStatus: tasks.status,
    details: `pending=${pending}, in_progress=${inProgress}`,
  });

  // 5) Integrations surface checks
  const telegramWebhook = await requestJson(endpoint(baseUrl, "/api/agent/telegram"), { method: "GET" });
  results.push({
    id: "integrations_telegram_webhook",
    category: "integrations",
    name: "Telegram webhook endpoint",
    critical: false,
    status: toStatus(telegramWebhook.status === 200),
    httpStatus: telegramWebhook.status,
    details: telegramWebhook.status === 200 ? "Telegram webhook endpoint reachable" : `Expected 200, got ${telegramWebhook.status}`,
  });

  const whatsappWebhook = await requestJson(
    endpoint(baseUrl, "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=locksafe_whatsapp_verify_2024&hub.challenge=dailycheck"),
    { method: "GET" }
  );
  results.push({
    id: "integrations_whatsapp_webhook",
    category: "integrations",
    name: "WhatsApp webhook verification endpoint",
    critical: false,
    status: toStatus(whatsappWebhook.status === 200),
    httpStatus: whatsappWebhook.status,
    details: whatsappWebhook.status === 200 ? "WhatsApp verify endpoint reachable" : `Expected 200, got ${whatsappWebhook.status}`,
  });

  // 6) Hermes/Ollama check
  const ollamaBaseUrl = (options?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "").trim();
  if (ollamaBaseUrl) {
    try {
      const ollama = await requestJson(`${ollamaBaseUrl.replace(/\/$/, "")}/api/tags`, { method: "GET" });
      const models = ((ollama.body?.models as Array<JsonMap>) || []).map((m) => String(m.name || ""));
      const hasHermes = models.some((m) => m.toLowerCase().includes("hermes"));
      results.push({
        id: "integrations_ollama",
        category: "integrations",
        name: "Ollama/Hermes endpoint",
        critical: true,
        status: toStatus(ollama.status === 200 && hasHermes, ollama.status === 200 && !hasHermes),
        httpStatus: ollama.status,
        details: `models_detected=${models.length}, hermes_present=${hasHermes}`,
      });
    } catch (error) {
      results.push({
        id: "integrations_ollama",
        category: "integrations",
        name: "Ollama/Hermes endpoint",
        critical: true,
        status: "FAIL",
        details: error instanceof Error ? error.message : "Unknown Ollama error",
      });
    }
  } else {
    results.push({
      id: "integrations_ollama",
      category: "integrations",
      name: "Ollama/Hermes endpoint",
      critical: true,
      status: "WARN",
      details: "OLLAMA_BASE_URL not set",
    });
  }

  return {
    timestamp: new Date().toISOString(),
    baseUrl,
    score: computeReliabilityScore(results),
    results,
  };
}

export function computeReliabilityScore(results: CheckResult[]): ReliabilityScore {
  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;

  const weightedTotal = results.reduce((sum, r) => sum + (r.critical ? 2 : 1), 0);
  const weightedEarned = results.reduce((sum, r) => {
    const w = r.critical ? 2 : 1;
    if (r.status === "PASS") return sum + w;
    if (r.status === "WARN") return sum + w * 0.5;
    return sum;
  }, 0);

  const score = Math.round((weightedEarned / Math.max(1, weightedTotal)) * 100);
  const criticalFailures = results.filter((r) => r.critical && r.status === "FAIL").length;

  let overall: "GREEN" | "AMBER" | "RED" = "GREEN";
  if (criticalFailures > 0 || score < 70) overall = "RED";
  else if (warn > 0 || score < 90) overall = "AMBER";

  return { score, overall, pass, warn, fail };
}

export function formatDailyReliabilityMarkdown(report: ReliabilityReport): string {
  const dateStamp = report.timestamp.slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Daily Reliability Scorecard - ${dateStamp}`);
  lines.push("");
  lines.push(`- Timestamp (UTC): ${report.timestamp}`);
  lines.push(`- Base URL: ${report.baseUrl}`);
  lines.push(`- Overall: ${report.score.overall}`);
  lines.push(`- Score: ${report.score.score}/100`);
  lines.push(`- Result counts: PASS=${report.score.pass}, WARN=${report.score.warn}, FAIL=${report.score.fail}`);
  lines.push("");
  lines.push("## Check Results");
  lines.push("");
  lines.push("| Category | Check | Critical | Status | HTTP | Details |");
  lines.push("|---|---|---|---|---|---|");

  for (const r of report.results) {
    lines.push(`| ${r.category} | ${r.name} | ${r.critical ? "yes" : "no"} | ${r.status} | ${r.httpStatus ?? "-"} | ${r.details} |`);
  }

  lines.push("");
  lines.push("## Action Items");
  lines.push("");
  const failed = report.results.filter((r) => r.status === "FAIL");
  const warned = report.results.filter((r) => r.status === "WARN");

  if (failed.length === 0 && warned.length === 0) {
    lines.push("- No action required. Continue daily monitoring.");
  } else {
    for (const r of failed) {
      lines.push(`- [P1] Fix failed check: ${r.name} (${r.details})`);
    }
    for (const r of warned) {
      lines.push(`- [P2] Review warning check: ${r.name} (${r.details})`);
    }
  }

  lines.push("");
  lines.push("## Owner Assignment Template");
  lines.push("");
  lines.push("- CTO: [fill]");
  lines.push("- COO: [fill]");
  lines.push("- CMO: [fill]");
  lines.push("- ETA to green: [fill]");

  return lines.join("\n");
}
