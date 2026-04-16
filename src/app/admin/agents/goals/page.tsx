"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Target,
  Trophy,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  Pause,
  Edit2,
  Trash2,
  Briefcase,
  Activity,
  DollarSign,
  Users,
} from "lucide-react";

interface CompanyGoal {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: number;
  targetMetric: string | null;
  targetValue: number | null;
  currentValue: number | null;
  progress: number;
  ownerAgentId: string | null;
  ownerAgentName: string | null;
  deadline: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: string;
  name: string;
  displayName: string;
}

const typeConfig = {
  strategic: {
    label: "Strategic",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: Target,
  },
  quarterly: {
    label: "Quarterly",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: Calendar,
  },
  project: {
    label: "Project",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: Briefcase,
  },
};

const statusConfig = {
  active: {
    label: "Active",
    color: "bg-green-100 text-green-800",
    icon: Activity,
  },
  completed: {
    label: "Completed",
    color: "bg-blue-100 text-blue-800",
    icon: CheckCircle,
  },
  paused: {
    label: "Paused",
    color: "bg-yellow-100 text-yellow-800",
    icon: Pause,
  },
};

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<CompanyGoal[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<CompanyGoal | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    type: "strategic",
    priority: 5,
    targetMetric: "",
    targetValue: 0,
    ownerAgentId: "",
    deadline: "",
  });

  const fetchData = useCallback(async () => {
    try {
      const [goalsRes, agentsRes] = await Promise.all([
        fetch("/api/agents/goals"),
        fetch("/api/agents"),
      ]);

      if (goalsRes.ok) {
        const data = await goalsRes.json();
        setGoals(data.goals || []);
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createGoal = async () => {
    if (!newGoal.title) return;

    try {
      const res = await fetch("/api/agents/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newGoal,
          targetValue: newGoal.targetValue || null,
          deadline: newGoal.deadline || null,
          ownerAgentId: newGoal.ownerAgentId || null,
        }),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewGoal({
          title: "",
          description: "",
          type: "strategic",
          priority: 5,
          targetMetric: "",
          targetValue: 0,
          ownerAgentId: "",
          deadline: "",
        });
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to create goal:", error);
    }
  };

  const updateGoal = async (goalId: string, updates: Partial<CompanyGoal>) => {
    try {
      const res = await fetch(`/api/agents/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setEditingGoal(null);
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to update goal:", error);
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    try {
      const res = await fetch(`/api/agents/goals/${goalId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  };

  const filteredGoals = goals.filter((goal) => {
    if (filterType !== "all" && goal.type !== filterType) return false;
    if (filterStatus !== "all" && goal.status !== filterStatus) return false;
    return true;
  });

  const stats = {
    total: goals.length,
    active: goals.filter((g) => g.status === "active").length,
    completed: goals.filter((g) => g.status === "completed").length,
    avgProgress:
      goals.length > 0
        ? goals.reduce((sum, g) => sum + g.progress, 0) / goals.length
        : 0,
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No deadline";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Company Goals</h1>
                <p className="text-gray-600">Strategic objectives for agent alignment</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={fetchData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Goal
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Company Goal</DialogTitle>
                    <DialogDescription>
                      Define a new strategic objective for agents to align with
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={newGoal.title}
                        onChange={(e) =>
                          setNewGoal({ ...newGoal, title: e.target.value })
                        }
                        placeholder="e.g., Achieve £2M ARR"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={newGoal.description}
                        onChange={(e) =>
                          setNewGoal({ ...newGoal, description: e.target.value })
                        }
                        placeholder="Describe the goal and success criteria"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Type</label>
                        <Select
                          value={newGoal.type}
                          onValueChange={(value) =>
                            setNewGoal({ ...newGoal, type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="strategic">Strategic</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="project">Project</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Priority (1-10)</label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={newGoal.priority}
                          onChange={(e) =>
                            setNewGoal({
                              ...newGoal,
                              priority: parseInt(e.target.value) || 5,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Target Metric</label>
                        <Input
                          value={newGoal.targetMetric}
                          onChange={(e) =>
                            setNewGoal({ ...newGoal, targetMetric: e.target.value })
                          }
                          placeholder="e.g., ARR, Customer Count"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Target Value</label>
                        <Input
                          type="number"
                          value={newGoal.targetValue}
                          onChange={(e) =>
                            setNewGoal({
                              ...newGoal,
                              targetValue: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="e.g., 2000000"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Owner Agent</label>
                        <Select
                          value={newGoal.ownerAgentId}
                          onValueChange={(value) =>
                            setNewGoal({ ...newGoal, ownerAgentId: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select agent" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No owner</SelectItem>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Deadline</label>
                        <Input
                          type="date"
                          value={newGoal.deadline}
                          onChange={(e) =>
                            setNewGoal({ ...newGoal, deadline: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createGoal}>Create Goal</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Goals</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Target className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active Goals</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <Trophy className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Progress</p>
                  <p className="text-2xl font-bold">{stats.avgProgress.toFixed(0)}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="strategic">Strategic</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="project">Project</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Goals List */}
        <div className="space-y-4">
          {filteredGoals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No Goals Found</h3>
                <p className="text-gray-400 mb-4">
                  Create your first company goal to align agent activities
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredGoals.map((goal) => {
              const typeConf = typeConfig[goal.type as keyof typeof typeConfig] || typeConfig.strategic;
              const statusConf = statusConfig[goal.status as keyof typeof statusConfig] || statusConfig.active;
              const TypeIcon = typeConf.icon;
              const StatusIcon = statusConf.icon;
              const daysRemaining = getDaysRemaining(goal.deadline);

              return (
                <Card key={goal.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <TypeIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg">{goal.title}</h3>
                            <Badge className={typeConf.color}>{typeConf.label}</Badge>
                            <Badge className={statusConf.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConf.label}
                            </Badge>
                          </div>
                          <p className="text-gray-600 text-sm">{goal.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingGoal(goal)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteGoal(goal.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="text-sm">
                        <span className="text-gray-500">Priority:</span>
                        <span className="ml-2 font-medium">P{goal.priority}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Owner:</span>
                        <span className="ml-2 font-medium">
                          {goal.ownerAgentName || "Unassigned"}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Deadline:</span>
                        <span className="ml-2 font-medium">{formatDate(goal.deadline)}</span>
                        {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 && (
                          <Badge variant="outline" className="ml-2 text-orange-600 border-orange-200">
                            {daysRemaining}d left
                          </Badge>
                        )}
                        {daysRemaining !== null && daysRemaining < 0 && (
                          <Badge variant="outline" className="ml-2 text-red-600 border-red-200">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Target:</span>
                        <span className="ml-2 font-medium">
                          {goal.targetMetric
                            ? `${goal.currentValue?.toLocaleString() || 0} / ${goal.targetValue?.toLocaleString() || 0}`
                            : "No metric"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{goal.progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                    </div>

                    {goal.status === "active" && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateGoal(goal.id, { status: "paused" })}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateGoal(goal.id, {
                              status: "completed",
                              progress: 100,
                            })
                          }
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Mark Complete
                        </Button>
                        <Input
                          type="number"
                          placeholder="Update progress %"
                          className="w-32 h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const value = parseFloat((e.target as HTMLInputElement).value);
                              if (value >= 0 && value <= 100) {
                                updateGoal(goal.id, { progress: value });
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                      </div>
                    )}

                    {goal.status === "paused" && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <Button
                          size="sm"
                          onClick={() => updateGoal(goal.id, { status: "active" })}
                        >
                          <Activity className="w-4 h-4 mr-1" />
                          Resume
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      {editingGoal && (
        <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={editingGoal.title}
                  onChange={(e) =>
                    setEditingGoal({ ...editingGoal, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={editingGoal.description}
                  onChange={(e) =>
                    setEditingGoal({ ...editingGoal, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Progress (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editingGoal.progress}
                    onChange={(e) =>
                      setEditingGoal({
                        ...editingGoal,
                        progress: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Current Value</label>
                  <Input
                    type="number"
                    value={editingGoal.currentValue || 0}
                    onChange={(e) =>
                      setEditingGoal({
                        ...editingGoal,
                        currentValue: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingGoal(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateGoal(editingGoal.id, {
                    title: editingGoal.title,
                    description: editingGoal.description,
                    progress: editingGoal.progress,
                    currentValue: editingGoal.currentValue,
                  })
                }
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </AdminSidebar>
  );
}
