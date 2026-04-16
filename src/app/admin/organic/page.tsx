"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  TrendingUp,
  Hash,
  Zap,
  Settings,
  Play,
  Pause,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";

interface SocialPost {
  id: string;
  content: string;
  headline: string | null;
  hook: string | null;
  hookType: string | null;
  imageUrl: string | null;
  hashtags: string[];
  platforms: string[];
  aiGenerated: boolean;
  aiFramework: string | null;
  emotionalAngle: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  facebookPostId: string | null;
  instagramPostId: string | null;
  impressions: number;
  reach: number;
  engagement: number;
  pillar: {
    id: string;
    name: string;
    displayName: string;
    color: string;
  } | null;
  createdAt: string;
}

interface Stats {
  byStatus: Array<{ status: string; _count: { id: number } }>;
  byPillar: Array<{ pillarId: string; _count: { id: number } }>;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHING: "bg-purple-100 text-purple-700",
  PUBLISHED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  ARCHIVED: "bg-slate-200 text-slate-500",
};

const statusIcons: Record<string, typeof Clock> = {
  DRAFT: Edit,
  PENDING_APPROVAL: Clock,
  APPROVED: CheckCircle,
  SCHEDULED: Calendar,
  PUBLISHING: RefreshCw,
  PUBLISHED: CheckCircle,
  FAILED: XCircle,
  REJECTED: XCircle,
  ARCHIVED: Trash2,
};

export default function OrganicPostsPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPillar, setSelectedPillar] = useState("all");
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [generatingContent, setGeneratingContent] = useState(false);

  useEffect(() => {
    fetchPosts();
    fetchAutopilotStatus();
  }, [selectedStatus, selectedPillar]);

  const fetchPosts = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedPillar !== "all") params.set("pillar", selectedPillar);

      const response = await fetch(`/api/admin/organic?${params}`);
      const data = await response.json();

      if (data.success) {
        setPosts(data.posts);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAutopilotStatus = async () => {
    try {
      const response = await fetch("/api/admin/organic/autopilot");
      const data = await response.json();
      if (data.success && data.config) {
        setAutopilotEnabled(data.config.isEnabled);
      }
    } catch (error) {
      console.error("Error fetching autopilot status:", error);
    }
  };

  const handleGenerateContent = async () => {
    setGeneratingContent(true);
    try {
      const response = await fetch("/api/admin/organic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          saveAsDrafts: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Generated content for ${Object.keys(data.batch).length} pillars!`);
        fetchPosts();
      }
    } catch (error) {
      console.error("Error generating content:", error);
      alert("Failed to generate content");
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`/api/admin/organic/${postId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleApprovePost = async (postId: string) => {
    try {
      const response = await fetch(`/api/admin/organic/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APPROVED",
          approvedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error("Error approving post:", error);
    }
  };

  const handlePublishPost = async (postId: string) => {
    try {
      const response = await fetch(`/api/admin/organic/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.success) {
        alert("Post published successfully!");
        fetchPosts();
      } else {
        alert(`Failed to publish: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error publishing post:", error);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  // Calculate stats for dashboard
  const totalPosts = posts.length;
  const publishedPosts = posts.filter(p => p.status === "PUBLISHED").length;
  const scheduledPosts = posts.filter(p => p.status === "SCHEDULED").length;
  const pendingPosts = posts.filter(p => p.status === "PENDING_APPROVAL").length;

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
              Organic Posts
            </h1>
            <p className="text-slate-600 mt-1">
              Create, schedule, and manage organic social media content
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerateContent}
              disabled={generatingContent}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {generatingContent ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI Generate
                </>
              )}
            </Button>

            <Link href="/admin/organic/create">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
            </Link>

            <Link href="/admin/organic/calendar">
              <Button variant="outline" className="border-slate-300">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Button>
            </Link>

            <Link href="/admin/organic/settings">
              <Button variant="outline" className="border-slate-300">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-sm">Total Posts</span>
              <Hash className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{totalPosts}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-sm">Published</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600 mt-2">{publishedPosts}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-sm">Scheduled</span>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-2">{scheduledPosts}</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-sm">Pending Approval</span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-2">{pendingPosts}</p>
          </div>
        </div>

        {/* Autopilot Status */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 mb-8 border border-purple-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${autopilotEnabled ? "bg-green-100" : "bg-slate-100"}`}>
                <Zap className={`w-5 h-5 ${autopilotEnabled ? "text-green-600" : "text-slate-400"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Autopilot Mode</h3>
                <p className="text-sm text-slate-600">
                  {autopilotEnabled
                    ? "AI is automatically generating and scheduling content"
                    : "Enable autopilot to automatically generate content"
                  }
                </p>
              </div>
            </div>
            <Link href="/admin/organic/settings">
              <Button
                variant="outline"
                size="sm"
                className={autopilotEnabled ? "border-green-300 text-green-700" : ""}
              >
                {autopilotEnabled ? (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Running
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Configure
                  </>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 mb-6 border border-slate-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Filters:</span>
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PUBLISHED">Published</option>
              <option value="FAILED">Failed</option>
            </select>

            <select
              value={selectedPillar}
              onChange={(e) => setSelectedPillar(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Pillars</option>
              <option value="anti-fraud">Anti-Fraud</option>
              <option value="tips">Tips & Advice</option>
              <option value="stories">Stories</option>
              <option value="behind-scenes">Behind the Scenes</option>
              <option value="stats">Stats & Facts</option>
              <option value="engagement">Engagement</option>
            </select>

            <button
              type="button"
              onClick={fetchPosts}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-slate-200">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No posts yet</h3>
            <p className="text-slate-600 mb-4">
              Create your first organic post or let AI generate content for you.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleGenerateContent} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Generate
              </Button>
              <Link href="/admin/organic/create">
                <Button variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Manually
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Content</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Pillar</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Platforms</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Scheduled</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Performance</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {posts.map((post) => {
                    const StatusIcon = statusIcons[post.status] || Clock;

                    return (
                      <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            {post.hook && (
                              <p className="text-sm font-medium text-slate-900 mb-1">
                                {truncateContent(post.hook, 50)}
                              </p>
                            )}
                            <p className="text-sm text-slate-600">
                              {truncateContent(post.content)}
                            </p>
                            {post.aiGenerated && (
                              <span className="inline-flex items-center gap-1 mt-1 text-xs text-purple-600">
                                <Sparkles className="w-3 h-3" />
                                AI Generated
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {post.pillar ? (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              style={{
                                backgroundColor: `${post.pillar.color}20`,
                                color: post.pillar.color,
                              }}
                            >
                              {post.pillar.displayName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[post.status] || "bg-slate-100 text-slate-700"}`}>
                            <StatusIcon className="w-3 h-3" />
                            {post.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {post.platforms.includes("FACEBOOK") && (
                              <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs font-bold">
                                f
                              </span>
                            )}
                            {post.platforms.includes("INSTAGRAM") && (
                              <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded flex items-center justify-center text-xs font-bold">
                                ig
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {formatDate(post.scheduledFor)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {post.status === "PUBLISHED" ? (
                            <div className="flex items-center gap-3 text-sm">
                              <span className="text-slate-600">
                                <TrendingUp className="w-3 h-3 inline mr-1" />
                                {post.impressions.toLocaleString()}
                              </span>
                              <span className="text-slate-600">
                                {post.engagement} engagements
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/admin/organic/${post.id}`}>
                              <button type="button" className="p-1.5 hover:bg-slate-100 rounded transition-colors">
                                <Eye className="w-4 h-4 text-slate-500" />
                              </button>
                            </Link>

                            {post.status === "PENDING_APPROVAL" && (
                              <button
                                type="button"
                                onClick={() => handleApprovePost(post.id)}
                                className="p-1.5 hover:bg-green-100 rounded transition-colors"
                                title="Approve"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </button>
                            )}

                            {["DRAFT", "APPROVED"].includes(post.status) && (
                              <button
                                type="button"
                                onClick={() => handlePublishPost(post.id)}
                                className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                                title="Publish Now"
                              >
                                <Send className="w-4 h-4 text-blue-600" />
                              </button>
                            )}

                            {post.status !== "PUBLISHED" && (
                              <button
                                type="button"
                                onClick={() => handleDeletePost(post.id)}
                                className="p-1.5 hover:bg-red-100 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
