"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Link2,
  Copy,
  Check,
  Plus,
  Trash2,
  Save,
  Download,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface UTMTemplate {
  id: string;
  name: string;
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
  useCount: number;
}

export default function UTMBuilderPage() {
  // Single URL builder
  const [baseUrl, setBaseUrl] = useState("https://locksafe.uk/request");
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("paid");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // Bulk builder
  const [bulkUrls, setBulkUrls] = useState<string[]>([""]);
  const [bulkResults, setBulkResults] = useState<Array<{ original: string; withUTM: string }>>([]);

  // Templates
  const [templates, setTemplates] = useState<UTMTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"single" | "bulk" | "templates">("single");

  // Load templates
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Generate URL on change
  useEffect(() => {
    generateUrl();
  }, [baseUrl, source, medium, campaign, content, term]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/utm");
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const generateUrl = () => {
    if (!baseUrl) {
      setGeneratedUrl("");
      return;
    }

    try {
      const url = new URL(baseUrl);
      if (source) url.searchParams.set("utm_source", source);
      if (medium) url.searchParams.set("utm_medium", medium);
      if (campaign) url.searchParams.set("utm_campaign", campaign);
      if (content) url.searchParams.set("utm_content", content);
      if (term) url.searchParams.set("utm_term", term);
      setGeneratedUrl(url.toString());
    } catch {
      setGeneratedUrl("");
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveTemplate = async () => {
    if (!templateName || !source || !medium) return;

    setSavingTemplate(true);
    try {
      await fetch("/api/admin/utm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_template",
          name: templateName,
          source,
          medium,
          campaign,
          content,
          term,
        }),
      });
      await fetchTemplates();
      setShowSaveDialog(false);
      setTemplateName("");
    } catch (error) {
      console.error("Error saving template:", error);
    } finally {
      setSavingTemplate(false);
    }
  };

  const applyTemplate = (template: UTMTemplate) => {
    setSource(template.source);
    setMedium(template.medium);
    setCampaign(template.campaign || "");
    setContent(template.content || "");
    setTerm(template.term || "");
    setActiveTab("single");
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      await fetch("/api/admin/utm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_template",
          templateId,
        }),
      });
      await fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const generateBulkUrls = async () => {
    const validUrls = bulkUrls.filter((url) => url.trim());
    if (validUrls.length === 0) return;

    try {
      const res = await fetch("/api/admin/utm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          bulk: true,
          urls: validUrls,
          source,
          medium,
          campaign,
          content,
          term,
        }),
      });
      const data = await res.json();
      setBulkResults(data.results || []);
    } catch (error) {
      console.error("Error generating bulk URLs:", error);
    }
  };

  const downloadBulkResults = () => {
    const csv = [
      "Original URL,URL with UTM",
      ...bulkResults.map((r) => `"${r.original}","${r.withUTM}"`),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "utm_links.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link
              href="/admin/ads"
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Link2 className="h-5 w-5 text-blue-500" />
                UTM Link Builder
              </h1>
              <p className="text-slate-500 text-sm">
                Create trackable URLs for your marketing campaigns
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {[
              { id: "single", label: "Single URL" },
              { id: "bulk", label: "Bulk Generator" },
              { id: "templates", label: "Templates" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Single URL Tab */}
          {activeTab === "single" && (
            <div className="space-y-6">
              {/* URL Input */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://yourdomain.com/page"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* UTM Parameters */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">UTM Parameters</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Source <span className="text-red-500">*</span>
                      <span className="text-slate-400 font-normal ml-1">(utm_source)</span>
                    </label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      <option value="facebook">facebook</option>
                      <option value="instagram">instagram</option>
                      <option value="google">google</option>
                      <option value="twitter">twitter</option>
                      <option value="linkedin">linkedin</option>
                      <option value="email">email</option>
                      <option value="newsletter">newsletter</option>
                      <option value="direct">direct</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Where the traffic comes from</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Medium <span className="text-red-500">*</span>
                      <span className="text-slate-400 font-normal ml-1">(utm_medium)</span>
                    </label>
                    <select
                      value={medium}
                      onChange={(e) => setMedium(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      <option value="paid">paid</option>
                      <option value="cpc">cpc</option>
                      <option value="cpm">cpm</option>
                      <option value="organic">organic</option>
                      <option value="social">social</option>
                      <option value="email">email</option>
                      <option value="referral">referral</option>
                      <option value="display">display</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">Marketing medium or channel type</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Campaign
                      <span className="text-slate-400 font-normal ml-1">(utm_campaign)</span>
                    </label>
                    <input
                      type="text"
                      value={campaign}
                      onChange={(e) => setCampaign(e.target.value)}
                      placeholder="e.g., summer_sale_2026"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Specific campaign name</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Content
                      <span className="text-slate-400 font-normal ml-1">(utm_content)</span>
                    </label>
                    <input
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="e.g., banner_v1"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Differentiate similar content</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Term
                      <span className="text-slate-400 font-normal ml-1">(utm_term)</span>
                    </label>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      placeholder="e.g., locksmith+london"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">Paid search keywords (optional)</p>
                  </div>
                </div>
              </div>

              {/* Generated URL */}
              {generatedUrl && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-700">Generated URL</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSaveDialog(true)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Save as template"
                      >
                        <Save className="h-4 w-4 text-slate-500" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(generatedUrl)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Copy URL"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-500" />
                        )}
                      </button>
                      <a
                        href={generatedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Open URL"
                      >
                        <ExternalLink className="h-4 w-4 text-slate-500" />
                      </a>
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-lg p-4">
                    <code className="text-sm text-orange-400 break-all">{generatedUrl}</code>
                  </div>
                </div>
              )}

              {/* Parameter Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h3 className="text-sm font-medium text-slate-700 mb-4">Parameter Preview</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Source</div>
                    <div className="font-mono text-slate-900">{source || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Medium</div>
                    <div className="font-mono text-slate-900">{medium || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Campaign</div>
                    <div className="font-mono text-slate-900">{campaign || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Content</div>
                    <div className="font-mono text-slate-900">{content || "-"}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Term</div>
                    <div className="font-mono text-slate-900">{term || "-"}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bulk Tab */}
          {activeTab === "bulk" && (
            <div className="space-y-6">
              {/* UTM Parameters (same as single) */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">UTM Parameters for All URLs</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
                    <input
                      type="text"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Medium</label>
                    <input
                      type="text"
                      value={medium}
                      onChange={(e) => setMedium(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Campaign</label>
                    <input
                      type="text"
                      value={campaign}
                      onChange={(e) => setCampaign(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Content</label>
                    <input
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Term</label>
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* URL List */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-slate-700">URLs to Process</label>
                  <button
                    onClick={() => setBulkUrls([...bulkUrls, ""])}
                    className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1 font-medium"
                  >
                    <Plus className="h-3 w-3" />
                    Add URL
                  </button>
                </div>
                <div className="space-y-2">
                  {bulkUrls.map((url, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...bulkUrls];
                          newUrls[idx] = e.target.value;
                          setBulkUrls(newUrls);
                        }}
                        placeholder="https://yourdomain.com/page"
                        className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                      <button
                        onClick={() => {
                          if (bulkUrls.length > 1) {
                            setBulkUrls(bulkUrls.filter((_, i) => i !== idx));
                          }
                        }}
                        className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                        disabled={bulkUrls.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateBulkUrls}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Generate All URLs
              </button>

              {/* Results */}
              {bulkResults.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Generated URLs</h3>
                    <button
                      onClick={downloadBulkResults}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </button>
                  </div>
                  <div className="space-y-3">
                    {bulkResults.map((result, idx) => (
                      <div key={idx} className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 mb-1">Original:</div>
                        <div className="text-sm text-slate-600 mb-3 truncate">{result.original}</div>
                        <div className="text-xs text-slate-500 mb-1">With UTM:</div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-orange-600 flex-1 truncate">{result.withUTM}</code>
                          <button
                            onClick={() => copyToClipboard(result.withUTM)}
                            className="p-1.5 hover:bg-slate-200 rounded transition-colors"
                          >
                            <Copy className="h-3 w-3 text-slate-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === "templates" && (
            <div className="space-y-4">
              {templates.length === 0 ? (
                <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
                  <Save className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No templates yet</h3>
                  <p className="text-slate-500 mb-4">
                    Save UTM configurations as templates for quick reuse
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab("single");
                      setShowSaveDialog(true);
                    }}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Create First Template
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{template.name}</h3>
                          <p className="text-xs text-slate-500">Used {template.useCount} times</p>
                        </div>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-1 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Source:</span>
                          <span className="font-mono text-slate-700">{template.source}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Medium:</span>
                          <span className="font-mono text-slate-700">{template.medium}</span>
                        </div>
                        {template.campaign && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Campaign:</span>
                            <span className="font-mono text-slate-700">{template.campaign}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => applyTemplate(template)}
                        className="w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                      >
                        Use Template
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Save Template Dialog */}
          {showSaveDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-xl">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Save as Template</h3>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Facebook Paid Ads"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div className="bg-slate-50 rounded-lg p-4 mb-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <span>Source: <span className="text-slate-900 font-medium">{source}</span></span>
                    <span>Medium: <span className="text-slate-900 font-medium">{medium}</span></span>
                    {campaign && <span>Campaign: <span className="text-slate-900 font-medium">{campaign}</span></span>}
                    {content && <span>Content: <span className="text-slate-900 font-medium">{content}</span></span>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveTemplate}
                    disabled={!templateName || savingTemplate}
                    className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
                  >
                    {savingTemplate ? "Saving..." : "Save Template"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminSidebar>
  );
}
