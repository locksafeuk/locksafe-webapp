"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Plus,
  RefreshCw,
  Target,
  Globe,
  Copy,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  MousePointer,
  UserPlus,
  Percent,
  Calendar,
  ExternalLink,
  Sparkles,
  Link2,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface Audience {
  id: string;
  metaAudienceId: string | null;
  name: string;
  description: string | null;
  type: "SAVED" | "CUSTOM" | "LOOKALIKE";
  estimatedSize: number | null;
  aiGenerated: boolean;
  createdAt: string;
}

interface CreateForm {
  name: string;
  description: string;
  type: "website" | "lookalike" | "saved";
  retentionDays: number;
  includeAllVisitors: boolean;
  includeConversions: boolean;
  includePageViewers: boolean;
  pageViewUrl: string;
  sourceAudienceId: string;
  country: string;
  lookalikeRatio: number;
}

const defaultForm: CreateForm = {
  name: "",
  description: "",
  type: "website",
  retentionDays: 30,
  includeAllVisitors: true,
  includeConversions: false,
  includePageViewers: false,
  pageViewUrl: "",
  sourceAudienceId: "",
  country: "GB",
  lookalikeRatio: 1,
};

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchAudiences();
  }, []);

  const fetchAudiences = async (refresh = false) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/ads/audiences${refresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      setAudiences(data.audiences || []);
    } catch (err) {
      console.error("Error fetching audiences:", err);
    } finally {
      setLoading(false);
    }
  };

  const createAudience = async () => {
    if (!form.name) {
      setError("Audience name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/ads/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          type: form.type,
          retentionDays: form.retentionDays,
          includeAllVisitors: form.includeAllVisitors,
          includeConversions: form.includeConversions,
          includePageViewers: form.includePageViewers,
          pageViewUrl: form.pageViewUrl,
          sourceAudienceId: form.sourceAudienceId,
          country: form.country,
          lookalikeRatio: form.lookalikeRatio / 100, // Convert percentage to ratio
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create audience");
      }

      setSuccess(`Audience "${form.name}" created successfully!`);
      setShowCreateModal(false);
      setForm(defaultForm);
      await fetchAudiences();

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create audience");
    } finally {
      setCreating(false);
    }
  };

  const formatNumber = (num: number | null) => {
    if (!num) return "—";
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "CUSTOM":
        return <Globe className="h-5 w-5 text-blue-600" />;
      case "LOOKALIKE":
        return <Copy className="h-5 w-5 text-purple-600" />;
      case "SAVED":
        return <Target className="h-5 w-5 text-green-600" />;
      default:
        return <Users className="h-5 w-5 text-slate-400" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "CUSTOM":
        return "Website Visitors";
      case "LOOKALIKE":
        return "Lookalike";
      case "SAVED":
        return "Saved Audience";
      default:
        return type;
    }
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <Link
              href="/admin/ads"
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Ads
            </Link>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-500" />
              Custom Audiences
            </h1>
            <p className="text-slate-500 mt-1">
              Create and manage targeting audiences from website visitors
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => fetchAudiences(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sync from Meta
            </button>
            <button
              onClick={() => {
                setForm(defaultForm);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Audience
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-700">{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Quick Create Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => {
              setForm({
                ...defaultForm,
                type: "website",
                name: "All Website Visitors (30 days)",
                includeAllVisitors: true,
              });
              setShowCreateModal(true);
            }}
            className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-left hover:bg-blue-100 transition-colors"
          >
            <Globe className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">Website Visitors</h3>
            <p className="text-sm text-slate-500">
              Target anyone who visited your site in the last 30 days
            </p>
          </button>

          <button
            onClick={() => {
              setForm({
                ...defaultForm,
                type: "website",
                name: "Converters (90 days)",
                includeAllVisitors: false,
                includeConversions: true,
                retentionDays: 90,
              });
              setShowCreateModal(true);
            }}
            className="bg-green-50 border border-green-200 rounded-xl p-5 text-left hover:bg-green-100 transition-colors"
          >
            <Target className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">Past Converters</h3>
            <p className="text-sm text-slate-500">
              Target users who completed a booking or enquiry
            </p>
          </button>

          <button
            onClick={() => {
              setForm({
                ...defaultForm,
                type: "lookalike",
                name: "Lookalike - Top Customers",
              });
              setShowCreateModal(true);
            }}
            className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-left hover:bg-purple-100 transition-colors"
          >
            <Copy className="h-8 w-8 text-purple-600 mb-3" />
            <h3 className="font-semibold text-slate-900 mb-1">Lookalike Audience</h3>
            <p className="text-sm text-slate-500">
              Find new people similar to your best customers
            </p>
          </button>
        </div>

        {/* Audiences List */}
        {loading && audiences.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
          </div>
        ) : audiences.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Audiences Yet</h3>
            <p className="text-slate-500 mb-6">
              Create your first custom audience to start retargeting website visitors
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Your First Audience
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Audience
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {audiences.map((audience) => (
                  <tr key={audience.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(audience.type)}
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {audience.name}
                            {audience.aiGenerated && (
                              <Sparkles className="h-4 w-4 text-purple-500" />
                            )}
                          </div>
                          {audience.description && (
                            <div className="text-sm text-slate-500">{audience.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        audience.type === "CUSTOM"
                          ? "bg-blue-100 text-blue-700"
                          : audience.type === "LOOKALIKE"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {getTypeLabel(audience.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-slate-900">
                        <Users className="h-4 w-4 text-slate-400" />
                        {formatNumber(audience.estimatedSize)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(audience.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {audience.metaAudienceId && (
                        <a
                          href={`https://business.facebook.com/adsmanager/audiences?act=${process.env.NEXT_PUBLIC_META_AD_ACCOUNT_ID}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View in Meta
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Audience Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-6 w-6 text-orange-500" />
                  Create Custom Audience
                </h2>
              </div>

              <div className="p-6 space-y-6">
                {/* Audience Type */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Audience Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "website" })}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        form.type === "website"
                          ? "border-blue-500 bg-blue-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <Globe className={`h-6 w-6 mb-2 ${form.type === "website" ? "text-blue-600" : "text-slate-400"}`} />
                      <div className="font-medium text-slate-900">Website Visitors</div>
                      <div className="text-xs text-slate-500">From Meta Pixel</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "lookalike" })}
                      className={`p-4 rounded-lg border-2 text-left transition-colors ${
                        form.type === "lookalike"
                          ? "border-purple-500 bg-purple-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <Copy className={`h-6 w-6 mb-2 ${form.type === "lookalike" ? "text-purple-600" : "text-slate-400"}`} />
                      <div className="font-medium text-slate-900">Lookalike</div>
                      <div className="text-xs text-slate-500">Similar users</div>
                    </button>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Audience Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., All Website Visitors (30 days)"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g., Users who visited any page"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Website-specific options */}
                {form.type === "website" && (
                  <>
                    {/* Retention Days */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Calendar className="inline h-4 w-4 mr-1" />
                        Retention Period (Days)
                      </label>
                      <input
                        type="number"
                        value={form.retentionDays}
                        onChange={(e) => setForm({ ...form, retentionDays: parseInt(e.target.value) || 30 })}
                        min={1}
                        max={180}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        How long to keep users in this audience (1-180 days)
                      </p>
                    </div>

                    {/* Include Options */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Include Users Who...
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.includeAllVisitors}
                            onChange={(e) => setForm({ ...form, includeAllVisitors: e.target.checked })}
                            className="w-5 h-5 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                          />
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-2">
                              <Eye className="h-4 w-4 text-slate-400" />
                              All Visitors
                            </div>
                            <div className="text-xs text-slate-500">Anyone who visited any page</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.includeConversions}
                            onChange={(e) => setForm({ ...form, includeConversions: e.target.checked })}
                            className="w-5 h-5 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                          />
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-2">
                              <Target className="h-4 w-4 text-green-500" />
                              Converted
                            </div>
                            <div className="text-xs text-slate-500">Users who submitted a lead or made a purchase</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.includePageViewers}
                            onChange={(e) => setForm({ ...form, includePageViewers: e.target.checked })}
                            className="w-5 h-5 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                          />
                          <div>
                            <div className="font-medium text-slate-900 flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-blue-500" />
                              Specific Page Viewers
                            </div>
                            <div className="text-xs text-slate-500">Users who viewed a specific URL</div>
                          </div>
                        </label>

                        {form.includePageViewers && (
                          <input
                            type="text"
                            value={form.pageViewUrl}
                            onChange={(e) => setForm({ ...form, pageViewUrl: e.target.value })}
                            placeholder="e.g., /request or /locksmith-signup"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ml-8"
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Lookalike-specific options */}
                {form.type === "lookalike" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Source Audience ID
                      </label>
                      <input
                        type="text"
                        value={form.sourceAudienceId}
                        onChange={(e) => setForm({ ...form, sourceAudienceId: e.target.value })}
                        placeholder="Enter Meta Audience ID"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        The custom audience to base the lookalike on
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        <Percent className="inline h-4 w-4 mr-1" />
                        Lookalike Size ({form.lookalikeRatio}%)
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={form.lookalikeRatio}
                        onChange={(e) => setForm({ ...form, lookalikeRatio: parseInt(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>1% (Most Similar)</span>
                        <span>10% (Broader Reach)</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Country
                      </label>
                      <select
                        value={form.country}
                        onChange={(e) => setForm({ ...form, country: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="GB">United Kingdom</option>
                        <option value="US">United States</option>
                        <option value="IE">Ireland</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                      </select>
                    </div>
                  </>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setError(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={createAudience}
                  disabled={creating || !form.name}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {creating ? "Creating..." : "Create Audience"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            How Custom Audiences Work
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600">
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Website Custom Audiences</h4>
              <p>
                Created from users who visit your website with the Meta Pixel installed.
                Perfect for retargeting people who showed interest but didn't convert.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Lookalike Audiences</h4>
              <p>
                Meta finds new people similar to your best customers.
                Start with 1% for highest quality, increase to 10% for broader reach.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
