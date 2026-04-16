"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  Mail,
  Plus,
  Search,
  Send,
  Eye,
  BarChart3,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  MousePointer,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Edit2,
  RefreshCw,
  Check,
  Filter,
  FileText,
  Megaphone,
  Newspaper,
  Sparkles,
  AlertTriangle,
  Palette,
} from "lucide-react";

// Types
interface Locksmith {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  isVerified: boolean;
  totalJobs: number;
}

interface EmailRecipient {
  id: string;
  locksmithId: string;
  email: string;
  name: string;
  status: string;
  deliveredAt: string | null;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  bouncedAt: string | null;
  bounceReason: string | null;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  template: string;
  headline: string | null;
  body: string;
  ctaText: string | null;
  ctaUrl: string | null;
  accentColor: string;
  status: string;
  sentAt: string | null;
  scheduledFor: string | null;
  totalRecipients: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  createdAt: string;
  recipients?: EmailRecipient[];
}

interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

type ViewMode = "list" | "create" | "detail";
type EmailTemplate = "announcement" | "newsletter" | "update" | "promo" | "urgent" | "custom";

const TEMPLATES: { value: EmailTemplate; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  { value: "announcement", label: "Announcement", icon: <Megaphone className="w-5 h-5" />, description: "Important updates and news", color: "#f97316" },
  { value: "newsletter", label: "Newsletter", icon: <Newspaper className="w-5 h-5" />, description: "Regular updates and tips", color: "#1e293b" },
  { value: "update", label: "Platform Update", icon: <RefreshCw className="w-5 h-5" />, description: "Feature updates and changes", color: "#3b82f6" },
  { value: "promo", label: "Promotion", icon: <Sparkles className="w-5 h-5" />, description: "Special offers and incentives", color: "#16a34a" },
  { value: "urgent", label: "Urgent", icon: <AlertTriangle className="w-5 h-5" />, description: "Time-sensitive alerts", color: "#dc2626" },
  { value: "custom", label: "Custom", icon: <Palette className="w-5 h-5" />, description: "Custom styled email", color: "#7c3aed" },
];

const ACCENT_COLORS = [
  "#f97316", // Orange (default)
  "#3b82f6", // Blue
  "#16a34a", // Green
  "#dc2626", // Red
  "#7c3aed", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f59e0b", // Amber
];

export default function AdminEmailsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [locksmiths, setLocksmiths] = useState<Locksmith[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state for creating/editing campaigns
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    preheader: "",
    template: "announcement" as EmailTemplate,
    headline: "",
    body: "",
    ctaText: "",
    ctaUrl: "",
    accentColor: "#f97316",
    selectedLocksmithIds: [] as string[],
  });

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/admin/emails?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch locksmiths for selection
  const fetchLocksmiths = useCallback(async () => {
    try {
      const response = await fetch("/api/locksmiths?limit=1000");
      const data = await response.json();

      if (data.success) {
        setLocksmiths(data.locksmiths);
      }
    } catch (error) {
      console.error("Error fetching locksmiths:", error);
    }
  }, []);

  // Fetch single campaign with details
  const fetchCampaignDetails = async (campaignId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/emails/${campaignId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedCampaign(data.campaign);
        setCampaignStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching campaign details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchLocksmiths();
  }, [fetchCampaigns, fetchLocksmiths]);

  // Generate preview
  const generatePreview = async () => {
    try {
      const response = await fetch("/api/admin/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: formData.subject,
          preheader: formData.preheader,
          template: formData.template,
          headline: formData.headline,
          body: formData.body,
          ctaText: formData.ctaText,
          ctaUrl: formData.ctaUrl,
          accentColor: formData.accentColor,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPreviewHtml(data.html);
        setShowPreview(true);
      }
    } catch (error) {
      console.error("Error generating preview:", error);
    }
  };

  // Create campaign
  const createCampaign = async () => {
    if (!formData.name || !formData.subject || !formData.body) {
      alert("Please fill in name, subject, and body");
      return;
    }

    if (formData.selectedLocksmithIds.length === 0) {
      alert("Please select at least one locksmith");
      return;
    }

    try {
      setSending(true);
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          subject: formData.subject,
          preheader: formData.preheader,
          template: formData.template,
          headline: formData.headline,
          body: formData.body,
          ctaText: formData.ctaText,
          ctaUrl: formData.ctaUrl,
          accentColor: formData.accentColor,
          locksmithIds: formData.selectedLocksmithIds,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("Campaign created successfully!");
        resetForm();
        setViewMode("list");
        fetchCampaigns();
      } else {
        alert(data.error || "Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign");
    } finally {
      setSending(false);
    }
  };

  // Send campaign
  const sendCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to send this campaign? This action cannot be undone.")) {
      return;
    }

    try {
      setSending(true);
      const response = await fetch("/api/admin/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });

      const data = await response.json();

      if (data.success) {
        alert(data.message);
        fetchCampaigns();
        if (selectedCampaign?.id === campaignId) {
          fetchCampaignDetails(campaignId);
        }
      } else {
        alert(data.error || "Failed to send campaign");
      }
    } catch (error) {
      console.error("Error sending campaign:", error);
      alert("Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  // Delete campaign
  const deleteCampaign = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/emails/${campaignId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        alert("Campaign deleted");
        fetchCampaigns();
        if (viewMode === "detail") {
          setViewMode("list");
        }
      } else {
        alert(data.error || "Failed to delete campaign");
      }
    } catch (error) {
      console.error("Error deleting campaign:", error);
      alert("Failed to delete campaign");
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      subject: "",
      preheader: "",
      template: "announcement",
      headline: "",
      body: "",
      ctaText: "",
      ctaUrl: "",
      accentColor: "#f97316",
      selectedLocksmithIds: [],
    });
    setPreviewHtml("");
    setShowPreview(false);
  };

  // Toggle locksmith selection
  const toggleLocksmith = (locksmithId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedLocksmithIds: prev.selectedLocksmithIds.includes(locksmithId)
        ? prev.selectedLocksmithIds.filter((id) => id !== locksmithId)
        : [...prev.selectedLocksmithIds, locksmithId],
    }));
  };

  // Select/deselect all locksmiths
  const toggleAllLocksmiths = () => {
    if (formData.selectedLocksmithIds.length === filteredLocksmiths.length) {
      setFormData((prev) => ({ ...prev, selectedLocksmithIds: [] }));
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedLocksmithIds: filteredLocksmiths.map((ls) => ls.id),
      }));
    }
  };

  // Filter locksmiths by search
  const filteredLocksmiths = locksmiths.filter(
    (ls) =>
      ls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ls.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ls.companyName?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      DRAFT: { bg: "bg-slate-100", text: "text-slate-700", icon: <FileText className="w-3.5 h-3.5" /> },
      SCHEDULED: { bg: "bg-blue-100", text: "text-blue-700", icon: <Clock className="w-3.5 h-3.5" /> },
      SENDING: { bg: "bg-amber-100", text: "text-amber-700", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
      SENT: { bg: "bg-green-100", text: "text-green-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
      PAUSED: { bg: "bg-orange-100", text: "text-orange-700", icon: <AlertCircle className="w-3.5 h-3.5" /> },
      CANCELLED: { bg: "bg-red-100", text: "text-red-700", icon: <XCircle className="w-3.5 h-3.5" /> },
    };

    const badge = badges[status] || badges.DRAFT;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.icon}
        {status}
      </span>
    );
  };

  // Render Campaign List View
  const renderListView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Email Campaigns</h1>
          <p className="text-slate-500">Send beautiful emails to your locksmiths</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setViewMode("create");
          }}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{campaigns.length}</div>
              <div className="text-xs text-slate-500">Total Campaigns</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {campaigns.filter((c) => c.status === "SENT").length}
              </div>
              <div className="text-xs text-slate-500">Sent</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {campaigns.reduce((sum, c) => sum + c.totalOpened, 0)}
              </div>
              <div className="text-xs text-slate-500">Total Opens</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <MousePointer className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">
                {campaigns.reduce((sum, c) => sum + c.totalClicked, 0)}
              </div>
              <div className="text-xs text-slate-500">Total Clicks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <Button variant="outline" onClick={fetchCampaigns}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
            <p className="text-slate-500">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No campaigns yet</h3>
            <p className="text-slate-500 mb-4">Create your first email campaign to get started</p>
            <Button
              onClick={() => {
                resetForm();
                setViewMode("create");
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => {
                  fetchCampaignDetails(campaign.id);
                  setViewMode("detail");
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{campaign.name}</h3>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <p className="text-sm text-slate-500 truncate mb-2">{campaign.subject}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {campaign.totalRecipients} recipients
                      </span>
                      {campaign.status === "SENT" && (
                        <>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {campaign.totalOpened} opens
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointer className="w-3.5 h-3.5" />
                            {campaign.totalClicked} clicks
                          </span>
                        </>
                      )}
                      <span>{formatDate(campaign.sentAt || campaign.createdAt)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render Create Campaign View
  const renderCreateView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setViewMode("list")}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Create Email Campaign</h1>
          <p className="text-slate-500">Compose and send emails to locksmiths</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form - Left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Campaign Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., January Newsletter"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Important: New Feature Update"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Preheader Text
                </label>
                <input
                  type="text"
                  value={formData.preheader}
                  onChange={(e) => setFormData({ ...formData, preheader: e.target.value })}
                  placeholder="Preview text shown in inbox"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Shows as preview text in email clients</p>
              </div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Choose Template</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, template: template.value, accentColor: template.color })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    formData.template === template.value
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: `${template.color}20`, color: template.color }}
                  >
                    {template.icon}
                  </div>
                  <div className="font-medium text-slate-900 text-sm">{template.label}</div>
                  <div className="text-xs text-slate-500">{template.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Email Content</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Headline
                </label>
                <input
                  type="text"
                  value={formData.headline}
                  onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                  placeholder="Main heading of the email"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Body <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Write your email content here. You can use HTML for formatting."
                  rows={8}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Supports HTML. Use &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt; tags
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={formData.ctaText}
                    onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                    placeholder="e.g., Learn More"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CTA Button URL
                  </label>
                  <input
                    type="url"
                    value={formData.ctaUrl}
                    onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Accent Color
                </label>
                <div className="flex gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, accentColor: color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        formData.accentColor === color ? "border-slate-900 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recipients - Right column */}
        <div className="space-y-6">
          {/* Recipient Selection */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recipients</h2>
              <span className="text-sm text-slate-500">
                {formData.selectedLocksmithIds.length} selected
              </span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search locksmiths..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>

            {/* Select All */}
            <button
              type="button"
              onClick={toggleAllLocksmiths}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 mb-3 transition-colors"
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border ${
                  formData.selectedLocksmithIds.length === filteredLocksmiths.length &&
                  filteredLocksmiths.length > 0
                    ? "bg-orange-500 border-orange-500"
                    : "border-slate-300"
                }`}
              >
                {formData.selectedLocksmithIds.length === filteredLocksmiths.length &&
                  filteredLocksmiths.length > 0 && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm font-medium text-slate-700">
                Select All ({filteredLocksmiths.length})
              </span>
            </button>

            {/* Locksmith List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredLocksmiths.map((locksmith) => (
                <button
                  key={locksmith.id}
                  type="button"
                  onClick={() => toggleLocksmith(locksmith.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    formData.selectedLocksmithIds.includes(locksmith.id)
                      ? "border-orange-500 bg-orange-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center border ${
                      formData.selectedLocksmithIds.includes(locksmith.id)
                        ? "bg-orange-500 border-orange-500"
                        : "border-slate-300"
                    }`}
                  >
                    {formData.selectedLocksmithIds.includes(locksmith.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{locksmith.name}</span>
                      {locksmith.isVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{locksmith.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-3">
            <Button
              onClick={generatePreview}
              variant="outline"
              className="w-full"
              disabled={!formData.subject || !formData.body}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview Email
            </Button>
            <Button
              onClick={createCampaign}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={sending || !formData.name || !formData.subject || !formData.body || formData.selectedLocksmithIds.length === 0}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Create Campaign
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Email Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[70vh]">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-[600px] border-0"
                title="Email Preview"
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close
              </Button>
              <Button
                onClick={createCampaign}
                className="bg-orange-500 hover:bg-orange-600 text-white"
                disabled={sending}
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Create Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render Campaign Detail View
  const renderDetailView = () => {
    if (!selectedCampaign) {
      return (
        <div className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setSelectedCampaign(null);
              setViewMode("list");
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{selectedCampaign.name}</h1>
              {getStatusBadge(selectedCampaign.status)}
            </div>
            <p className="text-slate-500">{selectedCampaign.subject}</p>
          </div>
          <div className="flex gap-2">
            {selectedCampaign.status === "DRAFT" && (
              <>
                <Button variant="outline" onClick={() => deleteCampaign(selectedCampaign.id)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button
                  onClick={() => sendCampaign(selectedCampaign.id)}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={sending}
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Now
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        {campaignStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{campaignStats.total}</div>
                  <div className="text-xs text-slate-500">Recipients</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{campaignStats.delivered}</div>
                  <div className="text-xs text-slate-500">Delivered</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{campaignStats.opened}</span>
                    <span className="text-sm text-slate-500">({campaignStats.openRate}%)</span>
                  </div>
                  <div className="text-xs text-slate-500">Opened</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <MousePointer className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-900">{campaignStats.clicked}</span>
                    <span className="text-sm text-slate-500">({campaignStats.clickRate}%)</span>
                  </div>
                  <div className="text-xs text-slate-500">Clicked</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visual Stats Bar */}
        {campaignStats && selectedCampaign.status === "SENT" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-slate-700 mb-4">Email Performance</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Open Rate</span>
                  <span className="font-medium text-slate-900">{campaignStats.openRate}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
                    style={{ width: `${campaignStats.openRate}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Click Rate</span>
                  <span className="font-medium text-slate-900">{campaignStats.clickRate}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-500 rounded-full"
                    style={{ width: `${campaignStats.clickRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recipients List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-900">Recipients</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Recipient
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Delivered
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Opened
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                    Clicked
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedCampaign.recipients?.map((recipient) => (
                  <tr key={recipient.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{recipient.name}</div>
                      <div className="text-sm text-slate-500">{recipient.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {recipient.status === "delivered" ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Delivered
                        </span>
                      ) : recipient.status === "bounced" ? (
                        <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                          <XCircle className="w-4 h-4" />
                          Bounced
                        </span>
                      ) : recipient.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
                          <Send className="w-4 h-4" />
                          Sent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 text-sm">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(recipient.deliveredAt)}
                    </td>
                    <td className="px-4 py-3">
                      {recipient.openedAt ? (
                        <div>
                          <div className="flex items-center gap-1 text-amber-600 text-sm">
                            <Eye className="w-4 h-4" />
                            {recipient.openCount}x
                          </div>
                          <div className="text-xs text-slate-400">{formatDate(recipient.openedAt)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {recipient.clickedAt ? (
                        <div>
                          <div className="flex items-center gap-1 text-purple-600 text-sm">
                            <MousePointer className="w-4 h-4" />
                            {recipient.clickCount}x
                          </div>
                          <div className="text-xs text-slate-400">{formatDate(recipient.clickedAt)}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Email Content Preview */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-slate-900">Email Content</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Subject</div>
                <div className="font-medium text-slate-900">{selectedCampaign.subject}</div>
              </div>
              {selectedCampaign.preheader && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Preheader</div>
                  <div className="text-slate-600">{selectedCampaign.preheader}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Body</div>
                <div
                  className="prose prose-sm max-w-none text-slate-600"
                  dangerouslySetInnerHTML={{ __html: selectedCampaign.body }}
                />
              </div>
              {selectedCampaign.ctaText && selectedCampaign.ctaUrl && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Call to Action</div>
                  <a
                    href={selectedCampaign.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: selectedCampaign.accentColor }}
                  >
                    {selectedCampaign.ctaText}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
        {viewMode === "list" && renderListView()}
        {viewMode === "create" && renderCreateView()}
        {viewMode === "detail" && renderDetailView()}
      </div>
    </AdminSidebar>
  );
}
