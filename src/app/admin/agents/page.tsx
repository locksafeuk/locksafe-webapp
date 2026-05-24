"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toaster";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  Brain,
  RefreshCw,
  Play,
  Pause,
  DollarSign,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  TrendingUp,
  Briefcase,
  ListChecks,
  Trophy,
  Server,
  Code,
  Cpu,
  Wifi,
  WifiOff,
  CircleDot,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentStatus {
  id: string;
  name: string;
  displayName: string;
  status: string;
  lastHeartbeat: string | null;
  pulseStatus: "green" | "amber" | "red";
  budgetUsed: number;
  budgetTotal: number;
  budgetPct: number;
  pendingTasks: number;
  successRate: number;
}

interface LlmRuntime {
  total: number;
  localCount: number;
  openaiCount: number;
  unknownCount: number;
  localPct: number | null;
  lastModel: string | null;
  lastSeenAt: string | null;
}

interface SystemStatus {
  hermesModeEnabled: boolean;
  ollamaUrl: string | null;
  ollamaRuntimeReason?: string | null;
  pendingApprovals: number;
  todayExecutions: number;
  totalBudgetUsed: number;
  totalBudget: number;
  activeAgents: number;
  totalAgents: number;
  llmRuntime?: LlmRuntime;
}

interface ActivityItem {
  id: string;
  agentName: string;
  agentDisplayName: string;
  actionType: string;
  actionName: string;
  status: string;
  costUsd: number;
  durationMs: number | null;
  model: string | null;
  startedAt: string;
}

interface HeartbeatResult {
  agentName: string;
  success: boolean;
  actionsExecuted: number;
  costUsd: number;
  errors: string[];
}

interface LlmPolicy {
  openAiFallbackEnabled: boolean;
  openAiFallbackMinSeverity: "low" | "medium" | "high" | "critical";
  guardianModeEnabled: boolean;
  alertSensitivity: "all" | "workflow" | "critical";
  nonWorkflowHeartbeatMultiplier: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getAgentIcon(name: string) {
  const cls = "h-4 w-4";
  switch (name) {
    case "ceo": return <Briefcase className={cls} />;
    case "cto": return <Server className={cls} />;
    case "cmo": return <TrendingUp className={cls} />;
    case "coo": return <Target className={cls} />;
    case "copywriter": return <Code className={cls} />;
    case "ads-specialist": return <TrendingUp className={cls} />;
    default: return <Bot className={cls} />;
  }
}

function PulseDot({ status }: { status: "green" | "amber" | "red" }) {
  const colors = { green: "bg-green-500", amber: "bg-yellow-500", red: "bg-red-500" };
  return (
    <span className="relative flex h-2.5 w-2.5">
      {status === "green" && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[status]}`} />
    </span>
  );
}

function BudgetRing({ pct }: { pct: number }) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const filled = circ * (Math.min(pct, 100) / 100);
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="rotate-[-90deg]">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-muted/20" />
      <circle cx="22" cy="22" r={radius} fill="none" stroke={color} strokeWidth="3.5"
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MissionControlPage() {
  const { toast, toasts, dismiss } = useToast();
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [llmPolicy, setLlmPolicy] = useState<LlmPolicy>({
    openAiFallbackEnabled: false,
    openAiFallbackMinSeverity: "high",
    guardianModeEnabled: false,
    alertSensitivity: "workflow",
    nonWorkflowHeartbeatMultiplier: 1,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null);
  const [lastRefreshFailureAt, setLastRefreshFailureAt] = useState<Date | null>(null);
  const [statusRefreshOk, setStatusRefreshOk] = useState(true);
  const [activityRefreshOk, setActivityRefreshOk] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [togglingFallback, setTogglingFallback] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [testResults, setTestResults] = useState<HeartbeatResult[]>([]);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const activityRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/agents/status");
      if (!res.ok) {
        throw new Error(`status request failed (${res.status})`);
      }
      const data = await res.json();
      setAgents(data.agents ?? []);
      setSystem(data.system ?? null);
      setLastRefresh(new Date());
      setStatusRefreshOk(true);
      if (activityRefreshOk) setLastRefreshError(null);
      return true;
    } catch (error) {
      setStatusRefreshOk(false);
      setLastRefreshError(error instanceof Error ? error.message : "Could not load status");
      setLastRefreshFailureAt(new Date());
      if (!silent) {
        toast({
          title: "Refresh failed",
          description: error instanceof Error ? error.message : "Could not load status",
          variant: "error",
        });
      }
      return false;
    }
  }, [toast]);

  const fetchActivity = useCallback(async (silent = false) => {
    try {
      const res = await fetch("/api/agents/activity?limit=30");
      if (!res.ok) {
        throw new Error(`activity request failed (${res.status})`);
      }
      const data = await res.json();
      setActivity(data.activity ?? []);
      setActivityRefreshOk(true);
      if (statusRefreshOk) setLastRefreshError(null);
      return true;
    } catch (error) {
      setActivityRefreshOk(false);
      setLastRefreshError(error instanceof Error ? error.message : "Could not load activity");
      setLastRefreshFailureAt(new Date());
      if (!silent) {
        toast({
          title: "Refresh failed",
          description: error instanceof Error ? error.message : "Could not load activity",
          variant: "error",
        });
      }
      return false;
    }
  }, [toast]);

  const fetchLlmPolicy = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agents/llm-policy");
      if (!res.ok) return;
      const data = await res.json();
      if (data?.policy) {
        setLlmPolicy({
          openAiFallbackEnabled: Boolean(data.policy.openAiFallbackEnabled),
          openAiFallbackMinSeverity: (data.policy.openAiFallbackMinSeverity || "high") as LlmPolicy["openAiFallbackMinSeverity"],
          guardianModeEnabled: Boolean(data.policy.guardianModeEnabled),
          alertSensitivity: (data.policy.alertSensitivity || "workflow") as LlmPolicy["alertSensitivity"],
          nonWorkflowHeartbeatMultiplier: Math.max(1, Number(data.policy.nonWorkflowHeartbeatMultiplier ?? 1)),
        });
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(true), fetchActivity(true)]);
      setLoading(false);

      // Policy is non-critical for first paint; fetch it after the dashboard is interactive.
      void fetchLlmPolicy();
    };
    load();
  }, [fetchStatus, fetchActivity, fetchLlmPolicy]);

  useEffect(() => {
    if (!autoRefresh) return;
    const s = setInterval(() => { void fetchStatus(true); }, 15000);
    const a = setInterval(() => { void fetchActivity(true); }, 10000);
    return () => { clearInterval(s); clearInterval(a); };
  }, [autoRefresh, fetchStatus, fetchActivity]);

  const refreshDashboard = async () => {
    setRefreshing(true);
    const [statusOk, activityOk] = await Promise.all([
      fetchStatus(false),
      fetchActivity(false),
    ]);
    setRefreshing(false);

    if (statusOk && activityOk) {
      setLastRefreshError(null);
      setLastRefreshFailureAt(null);
      toast({ title: "Dashboard refreshed" });
    }
  };

  const toggleAgent = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    await fetchStatus();
  };

  const runSingleAgent = async (agentId: string) => {
    await fetch("/api/agents/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true, agentId }),
    });
    await Promise.all([fetchStatus(), fetchActivity()]);
  };

  const runFullTest = async () => {
    setTesting(true);
    setTestResults([]);
    setShowTestPanel(true);
    try {
      const res = await fetch("/api/agents/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      setTestResults(data.results ?? []);
      await Promise.all([fetchStatus(), fetchActivity()]);
    } catch (err) {
      setTestResults([{ agentName: "System", success: false, actionsExecuted: 0, costUsd: 0,
        errors: [err instanceof Error ? err.message : "Network error"] }]);
    }
    setTesting(false);
  };

  const toggleEmergencyFallback = async () => {
    setTogglingFallback(true);
    try {
      const res = await fetch("/api/admin/agents/llm-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openAiFallbackEnabled: !llmPolicy.openAiFallbackEnabled,
          openAiFallbackMinSeverity: llmPolicy.openAiFallbackMinSeverity || "high",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.policy) {
          setLlmPolicy({
            openAiFallbackEnabled: Boolean(data.policy.openAiFallbackEnabled),
            openAiFallbackMinSeverity: (data.policy.openAiFallbackMinSeverity || "high") as LlmPolicy["openAiFallbackMinSeverity"],
            guardianModeEnabled: Boolean(data.policy.guardianModeEnabled),
            alertSensitivity: (data.policy.alertSensitivity || "workflow") as LlmPolicy["alertSensitivity"],
            nonWorkflowHeartbeatMultiplier: Math.max(1, Number(data.policy.nonWorkflowHeartbeatMultiplier ?? 1)),
          });
          toast({
            title: data.policy.openAiFallbackEnabled
              ? `Emergency fallback enabled (${data.policy.openAiFallbackMinSeverity})`
              : "Emergency fallback disabled",
          });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to update fallback policy");
      }
    } catch (error) {
      toast({
        title: "Failed to update fallback policy",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setTogglingFallback(false);
    }
  };

  const updateOperationalPolicy = async (patch: Partial<LlmPolicy>, label: string) => {
    setSavingPolicy(true);
    try {
      const res = await fetch("/api/admin/agents/llm-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to update ${label}`);
      }
      const data = await res.json();
      if (data?.policy) {
        setLlmPolicy({
          openAiFallbackEnabled: Boolean(data.policy.openAiFallbackEnabled),
          openAiFallbackMinSeverity: (data.policy.openAiFallbackMinSeverity || "high") as LlmPolicy["openAiFallbackMinSeverity"],
          guardianModeEnabled: Boolean(data.policy.guardianModeEnabled),
          alertSensitivity: (data.policy.alertSensitivity || "workflow") as LlmPolicy["alertSensitivity"],
          nonWorkflowHeartbeatMultiplier: Math.max(1, Number(data.policy.nonWorkflowHeartbeatMultiplier ?? 1)),
        });
        toast({ title: `${label} updated` });
      }
    } catch (error) {
      toast({
        title: `Failed to update ${label}`,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setSavingPolicy(false);
    }
  };

  const toggleGuardianMode = () =>
    updateOperationalPolicy(
      { guardianModeEnabled: !llmPolicy.guardianModeEnabled },
      "Guardian Mode",
    );

  const changeAlertSensitivity = (value: LlmPolicy["alertSensitivity"]) =>
    updateOperationalPolicy({ alertSensitivity: value }, "Alert sensitivity");

  const changeHeartbeatMultiplier = (value: number) =>
    updateOperationalPolicy(
      { nonWorkflowHeartbeatMultiplier: value },
      "Heartbeat multiplier",
    );

  if (loading) {
    return (
      <AdminSidebar>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
            <p className="text-sm text-muted-foreground">Initialising Mission Control…</p>
          </div>
        </div>
      </AdminSidebar>
    );
  }

  const budgetPct = system && system.totalBudget > 0
    ? Math.round((system.totalBudgetUsed / system.totalBudget) * 100) : 0;
  const allGreen = agents.length > 0 && agents.every(a => a.pulseStatus === "green" && a.status === "active");

  return (
    <AdminSidebar>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 px-4 max-w-[1600px]">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2.5">
                <Brain className="h-7 w-7 text-orange-500" />
                Mission Control
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {lastRefresh ? `Last updated ${formatTimeAgo(lastRefresh.toISOString())}` : "LockSafe AI Agent Operating System"}
                {(!statusRefreshOk || !activityRefreshOk) && (
                  <span className="inline-flex items-center gap-1 text-red-500 ml-2" title={lastRefreshError ?? "Refresh issue detected"}>
                    <AlertTriangle className="h-3 w-3" />
                    Refresh issue
                    {lastRefreshFailureAt && (
                      <span className="text-xs text-muted-foreground">
                        since {formatTimeAgo(lastRefreshFailureAt.toISOString())}
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAutoRefresh(v => !v)}
                className={autoRefresh ? "text-green-600 border-green-600/50" : ""}>
                <CircleDot className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "animate-pulse text-green-500" : ""}`} />
                {autoRefresh ? "Live" : "Paused"}
              </Button>
              <Button variant="outline" size="sm" onClick={refreshDashboard} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                variant={llmPolicy.openAiFallbackEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleEmergencyFallback}
                disabled={togglingFallback}
                className={llmPolicy.openAiFallbackEnabled ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
              >
                {togglingFallback
                  ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />}
                {llmPolicy.openAiFallbackEnabled
                  ? `Fallback ON (${llmPolicy.openAiFallbackMinSeverity})`
                  : "Fallback OFF"}
              </Button>
              <Button
                variant={llmPolicy.guardianModeEnabled ? "default" : "outline"}
                size="sm"
                onClick={toggleGuardianMode}
                disabled={savingPolicy}
                className={llmPolicy.guardianModeEnabled ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                title="Guardian Mode: only COO + CTO run. Use during incidents to cut noise."
              >
                {savingPolicy
                  ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Target className="h-3.5 w-3.5 mr-1.5" />}
                {llmPolicy.guardianModeEnabled ? "Guardian ON" : "Guardian OFF"}
              </Button>
              <select
                value={llmPolicy.alertSensitivity}
                onChange={(e) => changeAlertSensitivity(e.target.value as LlmPolicy["alertSensitivity"])}
                disabled={savingPolicy}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                title="Telegram alert sensitivity for non-workflow agents"
              >
                <option value="all">Alerts: all</option>
                <option value="workflow">Alerts: workflow</option>
                <option value="critical">Alerts: critical only</option>
              </select>
              <select
                value={llmPolicy.nonWorkflowHeartbeatMultiplier}
                onChange={(e) => changeHeartbeatMultiplier(Number(e.target.value))}
                disabled={savingPolicy}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                title="Non-workflow heartbeat multiplier (higher = less frequent)"
              >
                <option value={1}>HB ×1</option>
                <option value={2}>HB ×2</option>
                <option value={3}>HB ×3</option>
                <option value={4}>HB ×4</option>
                <option value={6}>HB ×6</option>
              </select>
              <Button size="sm" onClick={runFullTest} disabled={testing}
                className="bg-orange-500 hover:bg-orange-600 text-white">
                {testing
                  ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                {testing ? "Running…" : "Run Full Test"}
              </Button>
            </div>
          </div>

          {/* System Health Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card className={`border ${system?.hermesModeEnabled ? "border-purple-500/40 bg-purple-500/5" : "border-orange-500/40 bg-orange-500/5"}`}>
              <CardContent className="p-3 flex items-center gap-2.5">
                <Cpu className={`h-5 w-5 shrink-0 ${system?.hermesModeEnabled ? "text-purple-500" : "text-orange-400"}`} />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">LLM</p>
                  <p className={`text-xs font-semibold truncate ${system?.hermesModeEnabled ? "text-purple-400" : "text-orange-400"}`}>
                    {system?.hermesModeEnabled ? "🟣 Local-first (Ollama)" : "🟠 OpenAI only"}
                  </p>
                  {(() => {
                    const rt = system?.llmRuntime;
                    if (rt && rt.total > 0) return (
                      <>
                        <p className="text-[10px] text-muted-foreground">
                          Local {rt.localCount} / OpenAI {rt.openaiCount}
                          {rt.localPct !== null && ` · ${rt.localPct}% local`} (24h)
                        </p>
                        {rt.lastModel && (
                          <p className="text-[10px] text-muted-foreground truncate" title={rt.lastModel}>
                            {rt.lastModel}{rt.lastSeenAt ? ` · ${formatTimeAgo(rt.lastSeenAt)}` : ""}
                          </p>
                        )}
                      </>
                    );
                    return <p className="text-[10px] text-muted-foreground">No executions in 24h</p>;
                  })()}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleEmergencyFallback(); }}
                    disabled={togglingFallback}
                    className="flex items-center gap-1.5 mt-0.5 cursor-pointer disabled:opacity-60"
                    title={llmPolicy.openAiFallbackEnabled ? "Click to disable OpenAI fallback" : "Click to enable OpenAI fallback"}
                  >
                    <span className={`relative inline-flex h-3.5 w-6 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                      llmPolicy.openAiFallbackEnabled ? "bg-amber-500" : "bg-muted-foreground/40"
                    }`}>
                      <span className={`pointer-events-none block h-2.5 w-2.5 rounded-full bg-white shadow transition-transform duration-200 ${
                        llmPolicy.openAiFallbackEnabled ? "translate-x-2.5" : "translate-x-0"
                      }`} />
                    </span>
                    <span className={`text-[10px] ${llmPolicy.openAiFallbackEnabled ? "text-amber-500" : "text-muted-foreground"}`}>
                      {togglingFallback
                        ? "Saving…"
                        : llmPolicy.openAiFallbackEnabled
                          ? `OpenAI fallback armed (${llmPolicy.openAiFallbackMinSeverity}+)`
                          : "OpenAI fallback off"}
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 flex items-center gap-2.5">
                <Bot className="h-5 w-5 text-green-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Agents</p>
                  <p className="text-sm font-bold">
                    {system?.activeAgents ?? 0}
                    <span className="font-normal text-muted-foreground">/{system?.totalAgents ?? 0}</span>
                    <span className="ml-1 text-xs font-normal text-muted-foreground">active</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 flex items-center gap-2.5">
                <DollarSign className="h-5 w-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Monthly Cost</p>
                  <p className="text-sm font-bold">
                    ${system?.totalBudgetUsed.toFixed(2) ?? "0.00"}
                    <span className="text-xs font-normal text-muted-foreground"> / ${system?.totalBudget.toFixed(0) ?? "0"}</span>
                  </p>
                  <Progress value={budgetPct} className="h-1 mt-1" />
                </div>
              </CardContent>
            </Card>

            <Card className={system?.pendingApprovals ? "border-yellow-500/40" : ""}>
              <CardContent className="p-3 flex items-center gap-2.5">
                <AlertTriangle className={`h-5 w-5 shrink-0 ${system?.pendingApprovals ? "text-yellow-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</p>
                  <p className="text-sm font-bold">{system?.pendingApprovals ?? 0}
                    <span className="text-xs font-normal text-muted-foreground ml-1">approvals</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 flex items-center gap-2.5">
                <Activity className="h-5 w-5 text-blue-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Today</p>
                  <p className="text-sm font-bold">{system?.todayExecutions ?? 0}
                    <span className="text-xs font-normal text-muted-foreground ml-1">actions</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Results Panel */}
          {showTestPanel && (
            <Card className={`mb-6 ${testing ? "border-orange-500/40" : testResults.every(r => r.success) ? "border-green-500/40" : "border-red-500/40"}`}>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {testing ? <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                      : testResults.every(r => r.success) ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <AlertTriangle className="h-4 w-4 text-red-500" />}
                    {testing ? "Running agents…"
                      : `Test complete — ${testResults.filter(r => r.success).length}/${testResults.length} succeeded`}
                  </CardTitle>
                  {!testing && (
                    <Button variant="ghost" size="sm" onClick={() => setShowTestPanel(false)} className="h-6 text-xs">
                      Dismiss
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {testing && testResults.length === 0 ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {agents.map(a => (
                      <Badge key={a.id} variant="outline" className="text-xs gap-1">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                        {a.displayName}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {testResults.map((r, i) => (
                      <div key={i} className={`text-xs rounded-md p-2.5 flex items-start gap-2 ${r.success ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {r.success
                          ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                          : <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{r.agentName}</p>
                          <p className="text-muted-foreground">{r.actionsExecuted} actions · ${r.costUsd.toFixed(4)}</p>
                          {r.errors.length > 0 && <p className="text-red-400 truncate">{r.errors[0]}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Nav */}
          <div className="flex items-center gap-2 mb-5">
            <Link href="/admin/agents/tasks">
              <Button variant="outline" size="sm">
                <ListChecks className="h-3.5 w-3.5 mr-1.5" />Tasks
              </Button>
            </Link>
            <Link href="/admin/agents/goals">
              <Button variant="outline" size="sm">
                <Trophy className="h-3.5 w-3.5 mr-1.5" />Goals
              </Button>
            </Link>
            <Link href="/admin/agents/approvals">
              <Button variant="outline" size="sm" className={system?.pendingApprovals ? "border-yellow-500/50 text-yellow-600" : ""}>
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Approvals
                {(system?.pendingApprovals ?? 0) > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-4 text-[10px]">{system?.pendingApprovals}</Badge>
                )}
              </Button>
            </Link>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* Agent Cards (2/3) */}
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Agents</h2>
                {allGreen && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> All systems operational
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {agents.map((agent) => {
                  const budgetColor = agent.budgetPct >= 90 ? "text-red-500"
                    : agent.budgetPct >= 70 ? "text-yellow-500" : "text-green-500";
                  return (
                    <Card key={agent.id} className="relative overflow-hidden hover:shadow-md transition-shadow">
                      <div className={`absolute top-0 left-0 w-1 h-full ${
                        agent.status === "active" ? "bg-green-500"
                        : agent.status === "paused" ? "bg-yellow-500" : "bg-red-500"}`} />
                      <CardContent className="pt-4 pb-3 pl-5 pr-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
                              {getAgentIcon(agent.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <PulseDot status={agent.pulseStatus} />
                                <span className="font-semibold text-sm truncate">{agent.displayName}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {formatTimeAgo(agent.lastHeartbeat)}
                                {agent.pendingTasks > 0 && (
                                  <span className="ml-1.5 text-yellow-500">· {agent.pendingTasks} task{agent.pendingTasks !== 1 ? "s" : ""}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="relative shrink-0">
                            <BudgetRing pct={agent.budgetPct} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-[9px] font-bold ${budgetColor}`}>{agent.budgetPct}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Budget</span>
                            <span>${agent.budgetUsed.toFixed(2)} / ${agent.budgetTotal.toFixed(0)}</span>
                          </div>
                          <Progress value={agent.budgetPct} className="h-1.5" />
                        </div>
                        <div className="flex gap-1.5 mt-3">
                          <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
                            onClick={() => runSingleAgent(agent.id)} disabled={agent.status !== "active"}>
                            <Play className="h-3 w-3 mr-1" />Run
                          </Button>
                          <Button size="sm" variant={agent.status === "active" ? "outline" : "default"}
                            className="flex-1 h-7 text-xs" onClick={() => toggleAgent(agent.id, agent.status)}>
                            {agent.status === "active"
                              ? <><Pause className="h-3 w-3 mr-1" />Pause</>
                              : <><Play className="h-3 w-3 mr-1" />Resume</>}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                            onClick={() => window.location.href = `/admin/agents/${agent.id}`}>
                            ···
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {agents.length === 0 && (
                  <Card className="col-span-full">
                    <CardContent className="py-10 text-center">
                      <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <h3 className="font-medium mb-1">No Agents Initialised</h3>
                      <p className="text-sm text-muted-foreground mb-4">Run the full test to initialise</p>
                      <Button size="sm" onClick={runFullTest}>
                        <Zap className="h-3.5 w-3.5 mr-1.5" />Initialise Agents
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Autonomy Readiness Checklist */}
              <div className="mt-5">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Autonomy Readiness</h2>
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          label: "Hermes (Tailscale) connected",
                          ok: system?.hermesModeEnabled ?? false,
                          detail: system?.hermesModeEnabled
                            ? (system.ollamaUrl ?? "configured")
                            : (system?.ollamaRuntimeReason ?? "Set OLLAMA_BASE_URL in Vercel"),
                        },
                        {
                          label: "All agents active",
                          ok: (system?.activeAgents ?? 0) === (system?.totalAgents ?? 0) && (system?.totalAgents ?? 0) > 0,
                          detail: `${system?.activeAgents ?? 0}/${system?.totalAgents ?? 0} running`,
                        },
                        {
                          label: "No pending approvals",
                          ok: (system?.pendingApprovals ?? 0) === 0,
                          detail: (system?.pendingApprovals ?? 0) > 0 ? `${system?.pendingApprovals} awaiting review` : "Clear",
                        },
                        {
                          label: "Budget headroom",
                          ok: budgetPct < 80,
                          detail: `${budgetPct}% of total budget used`,
                        },
                        {
                          label: "Activity today",
                          ok: (system?.todayExecutions ?? 0) > 0,
                          detail: `${system?.todayExecutions ?? 0} executions`,
                        },
                        {
                          label: "Agents heartbeating",
                          ok: agents.some(a => a.pulseStatus === "green"),
                          detail: agents.filter(a => a.pulseStatus === "green").length + " green",
                        },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          {item.ok
                            ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            : <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                          <div className="min-w-0">
                            <span className="font-medium">{item.label}</span>
                            <p className="text-[11px] text-muted-foreground truncate">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Live Activity Feed (1/3) */}
            <div className="xl:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Live Activity</h2>
                <span className="text-[10px] text-muted-foreground">↻ 10s</span>
              </div>
              <Card className="sticky top-4">
                <CardContent className="p-0">
                  <div ref={activityRef} className="h-[600px] overflow-y-auto divide-y divide-border/50">
                    {activity.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                        <Activity className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">No activity yet</p>
                        <p className="text-xs mt-1">Run agents to see the feed</p>
                      </div>
                    ) : (
                      activity.map((item) => {
                        const modelName = item.model?.toLowerCase() ?? "";
                        const isLocalModel = /hermes|llama|qwen|mistral|gemma|deepseek|phi/.test(modelName);
                        const isOpenAiModel = /gpt|o1|o3|o4|openai/.test(modelName);
                        const modelBadge = isLocalModel ? "Hermes" : isOpenAiModel ? "OpenAI" : "Unknown";
                        const modelBadgeClass = isLocalModel
                          ? "bg-purple-500/20 text-purple-400"
                          : isOpenAiModel
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-muted text-muted-foreground";
                        return (
                          <div key={item.id} className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start gap-2">
                              {item.status === "success"
                                ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                                : item.status === "failed"
                                ? <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                                : <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-semibold text-orange-400">{item.agentDisplayName}</span>
                                  <span className="text-[10px] text-muted-foreground truncate">{item.actionName}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(item.startedAt)}</span>
                                  {item.costUsd > 0 && (
                                    <span className="text-[10px] text-muted-foreground font-mono">${item.costUsd.toFixed(4)}</span>
                                  )}
                                  {item.model && (
                                    <span className={`text-[9px] px-1 rounded ${modelBadgeClass}`}>
                                      {modelBadge}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tailscale Setup Prompt */}
          {system && !system.hermesModeEnabled && (
            <Card className="mt-5 border-purple-500/30 bg-purple-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <WifiOff className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-purple-300">Hermes not connected — agents using OpenAI (paid)</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {system?.ollamaRuntimeReason
                      ? system.ollamaRuntimeReason
                      : <>On your Mac Ultra: run <code className="bg-muted px-1 rounded text-[11px]">tailscale funnel 11434</code>, then set <code className="bg-muted px-1 rounded text-[11px]">OLLAMA_BASE_URL</code> in Vercel to your Tailscale URL (e.g. <code className="bg-muted px-1 rounded text-[11px]">https://&lt;hostname&gt;.ts.net</code>).</>}
                  </p>
                </div>
                <Wifi className="h-4 w-4 text-purple-400 shrink-0 mt-0.5 ml-auto" />
              </CardContent>
            </Card>
          )}

        </div>
      </div>
      <Toaster toasts={toasts} dismiss={dismiss} />
    </AdminSidebar>
  );
}
