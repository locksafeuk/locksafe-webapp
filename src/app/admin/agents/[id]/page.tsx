"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Bot,
  ArrowLeft,
  Play,
  Pause,
  RefreshCw,
  DollarSign,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Brain,
  Zap,
  Target,
  ListChecks,
  History,
  MessageSquare,
  Settings,
} from "lucide-react";

interface AgentDetail {
  id: string;
  name: string;
  displayName: string;
  role: string;
  status: string;
  heartbeatEnabled: boolean;
  heartbeatCronExpr: string;
  lastHeartbeat: string | null;
  nextHeartbeat: string | null;
  budgetUsedUsd: number;
  monthlyBudgetUsd: number;
  budgetResetAt: string | null;
  permissions: string[];
  governanceLevel: string;
  successRate: number;
  createdAt: string;
  updatedAt: string;
}

interface AgentTask {
  id: string;
  type: string;
  priority: number;
  status: string;
  description: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface AgentExecution {
  id: string;
  triggerType: string;
  status: string;
  actionsExecuted: number;
  tokensUsed: number;
  costUsd: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface AgentMemory {
  id: string;
  type: string;
  content: string;
  importance: number;
  createdAt: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningHeartbeat, setRunningHeartbeat] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchAgentData = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent);
        setTasks(data.tasks || []);
        setExecutions(data.executions || []);
        setMemories(data.memories || []);
      } else if (res.status === 404) {
        router.push("/admin/agents");
      }
    } catch (error) {
      console.error("Failed to fetch agent:", error);
    } finally {
      setLoading(false);
    }
  }, [agentId, router]);

  useEffect(() => {
    fetchAgentData();
  }, [fetchAgentData]);

  const toggleAgentStatus = async () => {
    if (!agent) return;
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchAgentData();
      }
    } catch (error) {
      console.error("Failed to toggle agent status:", error);
    }
  };

  const runSingleHeartbeat = async () => {
    setRunningHeartbeat(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/heartbeat`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchAgentData();
      }
    } catch (error) {
      console.error("Failed to run heartbeat:", error);
    }
    setRunningHeartbeat(false);
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "paused": return "bg-yellow-500";
      case "error": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getExecutionStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "running": return "bg-blue-100 text-blue-800";
      case "failed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <AdminSidebar>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AdminSidebar>
    );
  }

  if (!agent) {
    return (
      <AdminSidebar>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Agent Not Found</h2>
              <p className="text-gray-600 mb-4">The requested agent could not be found.</p>
              <Button onClick={() => router.push("/admin/agents")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Agents
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminSidebar>
    );
  }

  const budgetPercentage = (agent.budgetUsedUsd / agent.monthlyBudgetUsd) * 100;

  return (
    <AdminSidebar>
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/admin/agents")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{agent.displayName}</h1>
                <p className="text-gray-600">{agent.role}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  <span className="text-sm font-medium capitalize">{agent.status}</span>
                  <Badge variant="outline" className="ml-2">{agent.governanceLevel}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={runSingleHeartbeat}
                disabled={runningHeartbeat}
              >
                {runningHeartbeat ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Run Heartbeat
              </Button>
              <Button
                variant={agent.status === "active" ? "destructive" : "default"}
                onClick={toggleAgentStatus}
              >
                {agent.status === "active" ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause Agent
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Activate Agent
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Budget Used</p>
                  <p className="text-2xl font-bold">${agent.budgetUsedUsd.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">of ${agent.monthlyBudgetUsd}/month</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
              <Progress value={budgetPercentage} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold">{agent.successRate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">{executions.length} executions</p>
                </div>
                <Activity className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Last Heartbeat</p>
                  <p className="text-2xl font-bold">{formatTimeAgo(agent.lastHeartbeat)}</p>
                  <p className="text-xs text-gray-400">{agent.heartbeatCronExpr}</p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Tasks</p>
                  <p className="text-2xl font-bold">
                    {tasks.filter(t => t.status === "pending" || t.status === "in_progress").length}
                  </p>
                  <p className="text-xs text-gray-400">{tasks.length} total tasks</p>
                </div>
                <ListChecks className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="executions" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Executions
            </TabsTrigger>
            <TabsTrigger value="memory" className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              Memory
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Agent ID</p>
                      <p className="font-mono text-xs">{agent.id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Name</p>
                      <p className="font-medium">{agent.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Governance Level</p>
                      <Badge variant="outline">{agent.governanceLevel}</Badge>
                    </div>
                    <div>
                      <p className="text-gray-500">Created</p>
                      <p className="font-medium">{formatDate(agent.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {agent.permissions.map((perm, i) => (
                      <Badge key={i} variant="secondary">{perm}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {executions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No recent executions</p>
                  ) : (
                    <div className="space-y-3">
                      {executions.slice(0, 5).map((exec) => (
                        <div key={exec.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Badge className={getExecutionStatusColor(exec.status)}>
                              {exec.status}
                            </Badge>
                            <div>
                              <p className="font-medium">{exec.triggerType}</p>
                              <p className="text-sm text-gray-500">
                                {exec.actionsExecuted} actions • ${exec.costUsd.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">{formatTimeAgo(exec.startedAt)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>Agent Tasks</CardTitle>
                <CardDescription>Tasks assigned to this agent</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No tasks</p>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div key={task.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getTaskStatusColor(task.status)}>
                              {task.status}
                            </Badge>
                            <Badge variant="outline">{task.type}</Badge>
                            <span className="text-sm text-gray-500">Priority: {task.priority}</span>
                          </div>
                          <span className="text-sm text-gray-500">{formatTimeAgo(task.createdAt)}</span>
                        </div>
                        <p className="text-sm">{task.description}</p>
                        {task.result && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <strong>Result:</strong> {task.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Executions Tab */}
          <TabsContent value="executions">
            <Card>
              <CardHeader>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>Past heartbeat executions</CardDescription>
              </CardHeader>
              <CardContent>
                {executions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No executions yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2">Status</th>
                          <th className="text-left py-3 px-2">Trigger</th>
                          <th className="text-left py-3 px-2">Actions</th>
                          <th className="text-left py-3 px-2">Tokens</th>
                          <th className="text-left py-3 px-2">Cost</th>
                          <th className="text-left py-3 px-2">Started</th>
                          <th className="text-left py-3 px-2">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executions.map((exec) => {
                          const duration = exec.completedAt
                            ? Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)
                            : null;
                          return (
                            <tr key={exec.id} className="border-b hover:bg-gray-50">
                              <td className="py-3 px-2">
                                <Badge className={getExecutionStatusColor(exec.status)}>
                                  {exec.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-2">{exec.triggerType}</td>
                              <td className="py-3 px-2">{exec.actionsExecuted}</td>
                              <td className="py-3 px-2">{exec.tokensUsed.toLocaleString()}</td>
                              <td className="py-3 px-2">${exec.costUsd.toFixed(4)}</td>
                              <td className="py-3 px-2">{formatDate(exec.startedAt)}</td>
                              <td className="py-3 px-2">{duration !== null ? `${duration}s` : "-"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memory Tab */}
          <TabsContent value="memory">
            <Card>
              <CardHeader>
                <CardTitle>Agent Memory</CardTitle>
                <CardDescription>Stored patterns, decisions, and learned context</CardDescription>
              </CardHeader>
              <CardContent>
                {memories.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No memories stored</p>
                ) : (
                  <div className="space-y-3">
                    {memories.map((memory) => (
                      <div key={memory.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{memory.type}</Badge>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>Importance: {(memory.importance * 100).toFixed(0)}%</span>
                            <span>{formatTimeAgo(memory.createdAt)}</span>
                          </div>
                        </div>
                        <p className="text-sm">{memory.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Agent Settings</CardTitle>
                <CardDescription>Configuration and controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heartbeat Schedule
                    </label>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">{agent.heartbeatCronExpr}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Budget
                    </label>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">${agent.monthlyBudgetUsd}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Budget Reset Date
                    </label>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                      {agent.budgetResetAt ? formatDate(agent.budgetResetAt) : "Not set"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heartbeat Enabled
                    </label>
                    <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                      {agent.heartbeatEnabled ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AdminSidebar>
  );
}
