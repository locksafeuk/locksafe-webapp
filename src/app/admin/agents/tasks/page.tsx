"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle,
  Clock,
  AlertCircle,
  PlayCircle,
  XCircle,
  Filter,
  ListChecks,
  Target,
  Briefcase,
} from "lucide-react";

interface AgentTask {
  id: string;
  agentId: string;
  agentName: string;
  agentDisplayName: string;
  title: string;
  description: string;
  priority: number;
  status: string;
  result: string | null;
  delegatedFrom: string | null;
  companyGoalId: string | null;
  deadline: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Agent {
  id: string;
  name: string;
  displayName: string;
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: Clock,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: PlayCircle,
  },
  completed: {
    label: "Completed",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: XCircle,
  },
  blocked: {
    label: "Blocked",
    color: "bg-gray-100 text-gray-800 border-gray-200",
    icon: AlertCircle,
  },
};

export default function TaskManagementPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    agentId: "",
    title: "",
    description: "",
    priority: 5,
  });

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        fetch("/api/agents/tasks"),
        fetch("/api/agents"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
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

  const createTask = async () => {
    if (!newTask.agentId || !newTask.title) return;

    try {
      const res = await fetch("/api/agents/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });

      if (res.ok) {
        setIsCreateDialogOpen(false);
        setNewTask({ agentId: "", title: "", description: "", priority: 5 });
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const res = await fetch(`/api/agents/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`/api/agents/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== "all" && task.status !== filterStatus) return false;
    if (filterAgent !== "all" && task.agentId !== filterAgent) return false;
    return true;
  });

  const groupedTasks = {
    pending: filteredTasks.filter((t) => t.status === "pending"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    completed: filteredTasks.filter((t) => t.status === "completed"),
    failed: filteredTasks.filter((t) => t.status === "failed" || t.status === "blocked"),
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "N/A";
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

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "bg-red-500";
    if (priority >= 5) return "bg-yellow-500";
    return "bg-green-500";
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
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <ListChecks className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Task Management</h1>
                <p className="text-gray-600">Manage and track agent tasks</p>
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
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>
                      Assign a new task to an agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Agent</label>
                      <Select
                        value={newTask.agentId}
                        onValueChange={(value) =>
                          setNewTask({ ...newTask, agentId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={newTask.title}
                        onChange={(e) =>
                          setNewTask({ ...newTask, title: e.target.value })
                        }
                        placeholder="Task title"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={newTask.description}
                        onChange={(e) =>
                          setNewTask({ ...newTask, description: e.target.value })
                        }
                        placeholder="Task description"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Priority (1-10)</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={newTask.priority}
                        onChange={(e) =>
                          setNewTask({
                            ...newTask,
                            priority: parseInt(e.target.value) || 5,
                          })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createTask}>Create Task</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Filter:</span>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-gray-500">
            {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pending Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <h3 className="font-semibold text-gray-700">Pending</h3>
              <Badge variant="secondary" className="ml-auto">
                {groupedTasks.pending.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {groupedTasks.pending.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={updateTaskStatus}
                  onDelete={deleteTask}
                  formatTimeAgo={formatTimeAgo}
                  getPriorityColor={getPriorityColor}
                />
              ))}
              {groupedTasks.pending.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No pending tasks
                </div>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-gray-700">In Progress</h3>
              <Badge variant="secondary" className="ml-auto">
                {groupedTasks.in_progress.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {groupedTasks.in_progress.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={updateTaskStatus}
                  onDelete={deleteTask}
                  formatTimeAgo={formatTimeAgo}
                  getPriorityColor={getPriorityColor}
                />
              ))}
              {groupedTasks.in_progress.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No tasks in progress
                </div>
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="font-semibold text-gray-700">Completed</h3>
              <Badge variant="secondary" className="ml-auto">
                {groupedTasks.completed.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {groupedTasks.completed.slice(0, 10).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={updateTaskStatus}
                  onDelete={deleteTask}
                  formatTimeAgo={formatTimeAgo}
                  getPriorityColor={getPriorityColor}
                />
              ))}
              {groupedTasks.completed.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No completed tasks
                </div>
              )}
              {groupedTasks.completed.length > 10 && (
                <div className="text-center py-2 text-gray-400 text-sm">
                  +{groupedTasks.completed.length - 10} more
                </div>
              )}
            </div>
          </div>

          {/* Failed/Blocked Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="font-semibold text-gray-700">Failed / Blocked</h3>
              <Badge variant="secondary" className="ml-auto">
                {groupedTasks.failed.length}
              </Badge>
            </div>
            <div className="space-y-3">
              {groupedTasks.failed.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={updateTaskStatus}
                  onDelete={deleteTask}
                  formatTimeAgo={formatTimeAgo}
                  getPriorityColor={getPriorityColor}
                />
              ))}
              {groupedTasks.failed.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No failed tasks
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </AdminSidebar>
  );
}

function TaskCard({
  task,
  onStatusChange,
  onDelete,
  formatTimeAgo,
  getPriorityColor,
}: {
  task: AgentTask;
  onStatusChange: (taskId: string, status: string) => void;
  onDelete: (taskId: string) => void;
  formatTimeAgo: (date: string | null) => string;
  getPriorityColor: (priority: number) => string;
}) {
  const config = statusConfig[task.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card className="border shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
            <span className="text-xs text-gray-500">P{task.priority}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {task.agentDisplayName || task.agentName}
          </Badge>
        </div>

        <h4 className="font-medium text-sm mb-1 line-clamp-2">{task.title}</h4>
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">{formatTimeAgo(task.createdAt)}</span>
          <div className="flex items-center gap-1">
            {task.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => onStatusChange(task.id, "in_progress")}
              >
                <PlayCircle className="w-3 h-3 mr-1" />
                Start
              </Button>
            )}
            {task.status === "in_progress" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => onStatusChange(task.id, "completed")}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Done
              </Button>
            )}
            {(task.status === "failed" || task.status === "blocked") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => onStatusChange(task.id, "pending")}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-red-500 hover:text-red-700"
              onClick={() => onDelete(task.id)}
            >
              <XCircle className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
