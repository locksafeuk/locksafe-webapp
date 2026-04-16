"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
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
  Users,
  Briefcase,
  ListChecks,
  Trophy,
  Server,
  Code,
} from "lucide-react";
import Link from "next/link";

interface AgentData {
  id: string;
  name: string;
  displayName: string;
  role: string;
  status: string;
  lastHeartbeat: string | null;
  nextHeartbeat: string | null;
  budgetUsed: number;
  budgetTotal: number;
  pendingTasks: number;
  totalExecutions: number;
  successRate: number;
}

interface HeartbeatResult {
  agentName: string;
  success: boolean;
  actionsExecuted: number;
  costUsd: number;
  errors: string[];
}

interface ApprovalItem {
  id: string;
  agentName: string;
  actionType: string;
  actionDetails: string;
  reason: string;
  estimatedCost: number;
  createdAt: string;
}

export default function AgentDashboardPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningHeartbeat, setRunningHeartbeat] = useState(false);
  const [heartbeatResults, setHeartbeatResults] = useState<HeartbeatResult[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    }
  }, []);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/approvals");
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchApprovals()]);
      setLoading(false);
    };
    loadData();
  }, [fetchAgents, fetchApprovals]);

  const runHeartbeats = async (force = false) => {
    setRunningHeartbeat(true);
    setHeartbeatResults([]);
    try {
      const res = await fetch("/api/agents/heartbeat", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.ok) {
        setHeartbeatResults(data.results || []);
        if (data.results?.length === 0) {
          setHeartbeatResults([{
            agentName: "System",
            success: true,
            actionsExecuted: 0,
            costUsd: 0,
            errors: ["No agents due for heartbeat. Use 'Force Run All' to run all agents now."],
          }]);
        }
        await fetchAgents();
      } else {
        console.error("Heartbeat API error:", data);
        setHeartbeatResults([{
          agentName: "System",
          success: false,
          actionsExecuted: 0,
          costUsd: 0,
          errors: [data.error || data.details || "Failed to run heartbeats"],
        }]);
      }
    } catch (error) {
      console.error("Failed to run heartbeats:", error);
      setHeartbeatResults([{
        agentName: "System",
        success: false,
        actionsExecuted: 0,
        costUsd: 0,
        errors: [error instanceof Error ? error.message : "Network error"],
      }]);
    }
    setRunningHeartbeat(false);
  };

  const toggleAgentStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchAgents();
      }
    } catch (error) {
      console.error("Failed to toggle agent status:", error);
    }
  };

  const handleApproval = async (approvalId: string, approved: boolean) => {
    try {
      const res = await fetch(`/api/agents/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (res.ok) {
        await fetchApprovals();
      }
    } catch (error) {
      console.error("Failed to handle approval:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "paused": return "bg-yellow-500";
      case "terminated": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getAgentIcon = (name: string) => {
    switch (name) {
      case "ceo": return <Briefcase className="h-5 w-5" />;
      case "cto": return <Server className="h-5 w-5" />;
      case "cmo": return <TrendingUp className="h-5 w-5" />;
      case "coo": return <Target className="h-5 w-5" />;
      case "copywriter": return <Code className="h-5 w-5" />;
      case "ads-specialist": return <TrendingUp className="h-5 w-5" />;
      default: return <Bot className="h-5 w-5" />;
    }
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Never";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const totalBudgetUsed = agents.reduce((sum, a) => sum + a.budgetUsed, 0);
  const totalBudget = agents.reduce((sum, a) => sum + a.budgetTotal, 0);
  const activeAgents = agents.filter(a => a.status === "active").length;

  if (loading) {
    return (
      <AdminSidebar>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
        </div>
      </AdminSidebar>
    );
  }

  return (
    <AdminSidebar>
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-orange-500" />
            AI Agent Operating System
          </h1>
          <p className="text-muted-foreground mt-1">
            Autonomous agents managing LockSafe UK operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchAgents(); fetchApprovals(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => runHeartbeats(false)} disabled={runningHeartbeat}>
            {runningHeartbeat ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Run Due
          </Button>
          <Button onClick={() => runHeartbeats(true)} disabled={runningHeartbeat}>
            {runningHeartbeat ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Force Run All
          </Button>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/agents/tasks">
          <Button variant="outline" size="sm">
            <ListChecks className="h-4 w-4 mr-2" />
            Task Management
          </Button>
        </Link>
        <Link href="/admin/agents/goals">
          <Button variant="outline" size="sm">
            <Trophy className="h-4 w-4 mr-2" />
            Company Goals
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Agents</p>
                <p className="text-3xl font-bold">{activeAgents}/{agents.length}</p>
              </div>
              <Bot className="h-10 w-10 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Budget Used</p>
                <p className="text-3xl font-bold">${totalBudgetUsed.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">of ${totalBudget.toFixed(2)}</p>
              </div>
              <DollarSign className="h-10 w-10 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-3xl font-bold">{approvals.length}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Executions</p>
                <p className="text-3xl font-bold">
                  {agents.reduce((sum, a) => sum + a.totalExecutions, 0)}
                </p>
              </div>
              <Activity className="h-10 w-10 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Heartbeat Results */}
      {heartbeatResults.length > 0 && (
        <Card className="mb-8 border-green-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-500">
              <CheckCircle className="h-5 w-5" />
              Heartbeat Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {heartbeatResults.map((result, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">{result.agentName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{result.actionsExecuted} actions</span>
                    <span>${result.costUsd.toFixed(4)}</span>
                    {result.errors.length > 0 && (
                      <span className="text-red-500">{result.errors.length} errors</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Agents</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {approvals.length > 0 && (
              <Badge variant="destructive" className="ml-2">{approvals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="executions">Execution Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <Card key={agent.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(agent.status)}`} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        {getAgentIcon(agent.name)}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.displayName}</CardTitle>
                        <CardDescription className="text-xs">{agent.role}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Budget Progress */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">
                          ${agent.budgetUsed.toFixed(2)} / ${agent.budgetTotal.toFixed(2)}
                        </span>
                      </div>
                      <Progress
                        value={(agent.budgetUsed / agent.budgetTotal) * 100}
                        className="h-2"
                      />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Last Beat:</span>
                        <span className="font-medium">{formatTimeAgo(agent.lastHeartbeat)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Tasks:</span>
                        <span className="font-medium">{agent.pendingTasks}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant={agent.status === "active" ? "outline" : "default"}
                        onClick={() => toggleAgentStatus(agent.id, agent.status)}
                        className="flex-1"
                      >
                        {agent.status === "active" ? (
                          <>
                            <Pause className="h-4 w-4 mr-1" /> Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" /> Resume
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.location.href = `/admin/agents/${agent.id}`}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {agents.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Agents Initialized</h3>
                  <p className="text-muted-foreground mb-4">
                    Run heartbeats to initialize the agent system
                  </p>
                  <Button onClick={() => runHeartbeats(true)}>
                    <Zap className="h-4 w-4 mr-2" />
                    Initialize Agents
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Pending Approvals
              </CardTitle>
              <CardDescription>
                Actions requiring human approval before execution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending approvals</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {approvals.map((approval) => (
                    <div
                      key={approval.id}
                      className="p-4 border rounded-lg space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{approval.agentName}</Badge>
                            <span className="font-medium">{approval.actionType}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {approval.reason}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${approval.estimatedCost.toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(approval.createdAt)}
                          </p>
                        </div>
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {approval.actionDetails}
                      </pre>
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproval(approval.id, false)}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproval(approval.id, true)}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>
                Last 50 agent actions across all agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Execution log coming soon</p>
                <p className="text-sm">Run heartbeats to see agent activity</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AdminSidebar>
  );
}
