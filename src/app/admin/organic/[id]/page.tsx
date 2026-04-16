"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Image as ImageIcon,
  Calendar,
  Hash,
  Send,
  CheckCircle,
  XCircle,
  Facebook,
  Instagram,
  Sparkles,
  Eye,
  TrendingUp,
  Clock,
  Edit,
  Trash2,
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
  videoUrl: string | null;
  carouselImages: string[];
  hashtags: string[];
  platforms: string[];
  aiGenerated: boolean;
  aiPrompt: string | null;
  aiFramework: string | null;
  emotionalAngle: string | null;
  status: string;
  scheduledFor: string | null;
  publishedAt: string | null;
  facebookPostId: string | null;
  instagramPostId: string | null;
  publishError: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  impressions: number;
  reach: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  pillar: {
    id: string;
    name: string;
    displayName: string;
    color: string;
  } | null;
  createdAt: string;
  updatedAt: string;
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

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [post, setPost] = useState<SocialPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [content, setContent] = useState("");
  const [headline, setHeadline] = useState("");
  const [hook, setHook] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    fetchPost();
  }, [resolvedParams.id]);

  const fetchPost = async () => {
    try {
      const response = await fetch(`/api/admin/organic/${resolvedParams.id}`);
      const data = await response.json();

      if (data.success) {
        setPost(data.post);
        // Initialize form state
        setContent(data.post.content);
        setHeadline(data.post.headline || "");
        setHook(data.post.hook || "");
        setHashtags(data.post.hashtags);
        setImageUrl(data.post.imageUrl || "");
        setScheduledFor(data.post.scheduledFor ? new Date(data.post.scheduledFor).toISOString().slice(0, 16) : "");
        setSelectedPlatforms(data.post.platforms);
      } else {
        alert("Post not found");
        router.push("/admin/organic");
      }
    } catch (error) {
      console.error("Error fetching post:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/organic/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          headline,
          hook,
          hashtags,
          imageUrl: imageUrl || null,
          platforms: selectedPlatforms,
          scheduledFor: scheduledFor || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPost(data.post);
        setIsEditing(false);
        alert("Post updated successfully!");
      } else {
        alert(`Failed to update: ${data.error}`);
      }
    } catch (error) {
      console.error("Error saving post:", error);
      alert("Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/admin/organic/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "APPROVED",
          approvedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        fetchPost();
      }
    } catch (error) {
      console.error("Error approving post:", error);
    }
  };

  const handleReject = async () => {
    const reason = prompt("Enter rejection reason:");
    if (reason === null) return;

    try {
      const response = await fetch(`/api/admin/organic/${resolvedParams.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REJECTED",
          rejectionReason: reason,
        }),
      });

      if (response.ok) {
        fetchPost();
      }
    } catch (error) {
      console.error("Error rejecting post:", error);
    }
  };

  const handlePublish = async () => {
    if (!confirm("Publish this post immediately?")) return;

    try {
      const response = await fetch(`/api/admin/organic/${resolvedParams.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      if (data.success) {
        alert("Post published successfully!");
        fetchPost();
      } else {
        alert(`Failed to publish: ${data.error}`);
      }
    } catch (error) {
      console.error("Error publishing post:", error);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`/api/admin/organic/${resolvedParams.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.push("/admin/organic");
      }
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleAddHashtag = () => {
    if (hashtagInput.trim()) {
      const tag = hashtagInput.startsWith("#") ? hashtagInput : `#${hashtagInput}`;
      if (!hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setHashtagInput("");
    }
  };

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <AdminSidebar>
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </AdminSidebar>
    );
  }

  if (!post) {
    return (
      <AdminSidebar>
        <div className="p-8 text-center">
          <p className="text-slate-600">Post not found</p>
          <Link href="/admin/organic">
            <Button className="mt-4">Back to Posts</Button>
          </Link>
        </div>
      </AdminSidebar>
    );
  }

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/organic">
              <button type="button" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">Post Details</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[post.status]}`}>
                  {post.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-slate-600">Created {formatDate(post.createdAt)}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!isEditing && post.status !== "PUBLISHED" && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="border-slate-300"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}

            {post.status === "PENDING_APPROVAL" && (
              <>
                <Button
                  onClick={handleApprove}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  onClick={handleReject}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}

            {["DRAFT", "APPROVED"].includes(post.status) && (
              <Button
                onClick={handlePublish}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Publish Now
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Content Card */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="font-semibold text-slate-900 mb-4">Content</h2>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hook</label>
                    <input
                      type="text"
                      value={hook}
                      onChange={(e) => setHook(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Main Content</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Headline</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Image URL</label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hashtags</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={hashtagInput}
                        onChange={(e) => setHashtagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHashtag())}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <Button onClick={handleAddHashtag} variant="outline">Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-sm rounded"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => setHashtags(hashtags.filter(t => t !== tag))}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Platforms</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => togglePlatform("FACEBOOK")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                          selectedPlatforms.includes("FACEBOOK")
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-300 text-slate-600"
                        }`}
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePlatform("INSTAGRAM")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                          selectedPlatforms.includes("INSTAGRAM")
                            ? "border-pink-500 bg-pink-50 text-pink-700"
                            : "border-slate-300 text-slate-600"
                        }`}
                      >
                        <Instagram className="w-4 h-4" />
                        Instagram
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Schedule</label>
                    <input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setIsEditing(false)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {post.hook && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Hook</p>
                      <p className="text-lg font-medium text-slate-900">{post.hook}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-slate-500 mb-1">Content</p>
                    <p className="text-slate-700 whitespace-pre-wrap">{post.content}</p>
                  </div>

                  {post.headline && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Headline</p>
                      <p className="font-semibold text-slate-900">{post.headline}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-slate-500 mb-2">Hashtags</p>
                    <div className="flex flex-wrap gap-2">
                      {post.hashtags.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-slate-100 text-slate-700 text-sm rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Image Preview */}
            {post.imageUrl && (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h2 className="font-semibold text-slate-900 mb-4">Image</h2>
                <img
                  src={post.imageUrl}
                  alt="Post image"
                  className="w-full rounded-lg max-h-96 object-cover"
                />
              </div>
            )}

            {/* Performance Stats */}
            {post.status === "PUBLISHED" && (
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <h2 className="font-semibold text-slate-900 mb-4">Performance</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">{post.impressions.toLocaleString()}</p>
                    <p className="text-sm text-slate-600">Impressions</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">{post.reach.toLocaleString()}</p>
                    <p className="text-sm text-slate-600">Reach</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">{post.engagement.toLocaleString()}</p>
                    <p className="text-sm text-slate-600">Engagement</p>
                  </div>
                  <div className="text-center p-3 bg-slate-50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900">{post.clicks.toLocaleString()}</p>
                    <p className="text-sm text-slate-600">Clicks</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Meta Info */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="font-semibold text-slate-900 mb-4">Details</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Pillar</p>
                  {post.pillar ? (
                    <span
                      className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium mt-1"
                      style={{
                        backgroundColor: `${post.pillar.color}20`,
                        color: post.pillar.color,
                      }}
                    >
                      {post.pillar.displayName}
                    </span>
                  ) : (
                    <p className="text-slate-600">—</p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-slate-500">Platforms</p>
                  <div className="flex gap-2 mt-1">
                    {post.platforms.includes("FACEBOOK") && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded">
                        <Facebook className="w-3 h-3" />
                        Facebook
                      </span>
                    )}
                    {post.platforms.includes("INSTAGRAM") && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-pink-50 text-pink-700 text-sm rounded">
                        <Instagram className="w-3 h-3" />
                        Instagram
                      </span>
                    )}
                  </div>
                </div>

                {post.scheduledFor && (
                  <div>
                    <p className="text-sm text-slate-500">Scheduled For</p>
                    <p className="text-slate-900">{formatDate(post.scheduledFor)}</p>
                  </div>
                )}

                {post.publishedAt && (
                  <div>
                    <p className="text-sm text-slate-500">Published At</p>
                    <p className="text-slate-900">{formatDate(post.publishedAt)}</p>
                  </div>
                )}

                {post.aiGenerated && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-purple-600 mb-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm font-medium">AI Generated</span>
                    </div>
                    {post.aiFramework && (
                      <p className="text-sm text-slate-600">Framework: {post.aiFramework}</p>
                    )}
                    {post.emotionalAngle && (
                      <p className="text-sm text-slate-600">Angle: {post.emotionalAngle}</p>
                    )}
                  </div>
                )}

                {post.publishError && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-700">Publish Error</p>
                    <p className="text-sm text-red-600 mt-1">{post.publishError}</p>
                  </div>
                )}

                {post.rejectionReason && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-700">Rejection Reason</p>
                    <p className="text-sm text-red-600 mt-1">{post.rejectionReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <h2 className="font-semibold text-slate-900 mb-4">Actions</h2>

              <div className="space-y-2">
                {post.facebookPostId && (
                  <a
                    href={`https://www.facebook.com/${post.facebookPostId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Facebook className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">View on Facebook</span>
                  </a>
                )}

                {post.instagramPostId && (
                  <a
                    href={`https://www.instagram.com/p/${post.instagramPostId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 w-full px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-pink-600" />
                    <span className="text-sm">View on Instagram</span>
                  </a>
                )}

                {post.status !== "PUBLISHED" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-4 py-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete Post</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
