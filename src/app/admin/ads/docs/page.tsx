"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Book,
  Key,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings,
  Database,
  RefreshCw,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function DocsPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>("tokens");
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/ads"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Ads
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Book className="h-8 w-8 text-orange-500" />
            Meta Ads Integration Guide
          </h1>
          <p className="text-slate-500 mt-2">
            Complete documentation for connecting Meta Ads with your platform
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/admin/ads/setup"
            className="bg-orange-50 border border-orange-200 rounded-xl p-4 hover:bg-orange-100 transition-colors"
          >
            <Settings className="h-6 w-6 text-orange-600 mb-2" />
            <h3 className="font-semibold text-slate-900">Setup Wizard</h3>
            <p className="text-sm text-slate-500">Test connection & import campaigns</p>
          </Link>
          <a
            href="https://business.facebook.com/settings"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors"
          >
            <ExternalLink className="h-6 w-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-slate-900">Business Settings</h3>
            <p className="text-sm text-slate-500">Open Meta Business Manager</p>
          </a>
          <a
            href="https://developers.facebook.com/tools/explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-purple-50 border border-purple-200 rounded-xl p-4 hover:bg-purple-100 transition-colors"
          >
            <Zap className="h-6 w-6 text-purple-600 mb-2" />
            <h3 className="font-semibold text-slate-900">Graph API Explorer</h3>
            <p className="text-sm text-slate-500">Test API calls</p>
          </a>
        </div>

        {/* Section: Access Tokens */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6">
          <button
            onClick={() => toggleSection("tokens")}
            className="w-full px-6 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Key className="h-6 w-6 text-orange-500" />
              <div className="text-left">
                <h2 className="text-lg font-semibold text-slate-900">
                  Generating Long-Lived Access Tokens
                </h2>
                <p className="text-sm text-slate-500">
                  Create tokens that never expire for production use
                </p>
              </div>
            </div>
            {expandedSection === "tokens" ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedSection === "tokens" && (
            <div className="px-6 pb-6 border-t border-slate-100">
              <div className="prose prose-slate max-w-none mt-4">
                {/* Important Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-1">Important: Use System User Tokens</h4>
                      <p className="text-sm text-amber-700">
                        For production, always use <strong>System User</strong> tokens, not personal access tokens.
                        System User tokens can be set to never expire and are not tied to a personal account.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 1 */}
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-slate-900">
                    <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Go to Business Settings
                  </h3>
                  <p className="text-slate-600 ml-9">
                    Open <a href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">business.facebook.com/settings</a> and
                    navigate to <strong>Users → System Users</strong> in the left menu.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-slate-900">
                    <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Create a System User
                  </h3>
                  <ol className="text-slate-600 ml-9 list-decimal list-inside space-y-2">
                    <li>Click <strong>Add</strong></li>
                    <li>Enter a name like "LockSafe API User"</li>
                    <li>Select role: <strong>Admin</strong></li>
                    <li>Click <strong>Create System User</strong></li>
                  </ol>
                </div>

                {/* Step 3 */}
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-slate-900">
                    <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Assign Assets
                  </h3>
                  <p className="text-slate-600 ml-9 mb-2">
                    Click on your System User, then click <strong>Add Assets</strong> and assign:
                  </p>
                  <ul className="text-slate-600 ml-9 list-disc list-inside space-y-1">
                    <li><strong>Apps</strong> → Your Meta App → Full Control</li>
                    <li><strong>Ad Accounts</strong> → Your Ad Account → Full Control</li>
                    <li><strong>Pages</strong> → Your Facebook Page → Full Control</li>
                  </ul>
                </div>

                {/* Step 4 */}
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-slate-900">
                    <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Generate Access Token
                  </h3>
                  <ol className="text-slate-600 ml-9 list-decimal list-inside space-y-2">
                    <li>Click on your System User</li>
                    <li>Click <strong>Generate New Token</strong></li>
                    <li>Select your App</li>
                    <li>Set expiration to <strong>Never</strong> (if available)</li>
                    <li>Select these permissions:</li>
                  </ol>

                  <div className="ml-9 mt-3 bg-slate-900 rounded-lg p-4 text-sm">
                    <div className="text-slate-400 mb-2"># Required permissions:</div>
                    <div className="grid md:grid-cols-2 gap-1 font-mono text-xs">
                      <div className="text-green-400">✓ ads_management</div>
                      <div className="text-green-400">✓ ads_read</div>
                      <div className="text-green-400">✓ business_management</div>
                      <div className="text-green-400">✓ pages_read_engagement</div>
                      <div className="text-green-400">✓ pages_manage_engagement</div>
                      <div className="text-green-400">✓ pages_manage_posts</div>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-slate-900">
                    <span className="w-7 h-7 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                    Copy and Save Token
                  </h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 ml-9">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-red-900">Copy the token immediately!</h4>
                        <p className="text-sm text-red-700">
                          You will <strong>only see this token once</strong>. Copy it and save it securely.
                          Add it to your <code className="bg-red-100 px-1 rounded">.env</code> file as <code className="bg-red-100 px-1 rounded">META_ACCESS_TOKEN</code>.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Example .env */}
                <div className="bg-slate-900 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Example .env configuration</span>
                    <button
                      onClick={() => copyToClipboard(`META_ACCESS_TOKEN=EAAIxxxxxxxxxx...\nMETA_AD_ACCOUNT_ID=act_123456789\nMETA_PAGE_ID=123456789\nNEXT_PUBLIC_META_PIXEL_ID=123456789`, "env")}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copied === "env" ? <CheckCircle className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === "env" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <pre className="text-sm text-green-400 overflow-x-auto">
{`META_ACCESS_TOKEN=EAAIxxxxxxxxxx...
META_AD_ACCOUNT_ID=act_123456789
META_PAGE_ID=123456789
NEXT_PUBLIC_META_PIXEL_ID=123456789`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section: Token Expiration */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6">
          <button
            onClick={() => toggleSection("expiration")}
            className="w-full px-6 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-orange-500" />
              <div className="text-left">
                <h2 className="text-lg font-semibold text-slate-900">
                  Token Expiration & Renewal
                </h2>
                <p className="text-sm text-slate-500">
                  Understanding token lifecycles and how to renew them
                </p>
              </div>
            </div>
            {expandedSection === "expiration" ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedSection === "expiration" && (
            <div className="px-6 pb-6 border-t border-slate-100">
              <div className="mt-4 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <h3 className="font-semibold text-green-900">System User Tokens</h3>
                    </div>
                    <p className="text-sm text-green-700">
                      Can be set to <strong>never expire</strong>. This is the recommended approach for production.
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-amber-900">Personal Access Tokens</h3>
                    </div>
                    <p className="text-sm text-amber-700">
                      Expire after <strong>60 days</strong>. Not recommended for production use.
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">If Your Token Expires</h3>
                  <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                    <li>Go to Business Settings → System Users</li>
                    <li>Click on your System User</li>
                    <li>Click "Generate New Token"</li>
                    <li>Select the same permissions as before</li>
                    <li>Copy the new token and update your .env file</li>
                    <li>Restart your application</li>
                  </ol>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-2">Exchanging Short-Lived for Long-Lived Token</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    If you have a short-lived token from Graph API Explorer, you can exchange it for a long-lived one:
                  </p>
                  <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-xs text-slate-300">
{`curl -i -X GET "https://graph.facebook.com/v25.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={APP_ID}
  &client_secret={APP_SECRET}
  &fb_exchange_token={SHORT_LIVED_TOKEN}"`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section: Automatic Sync */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6">
          <button
            onClick={() => toggleSection("cron")}
            className="w-full px-6 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 text-orange-500" />
              <div className="text-left">
                <h2 className="text-lg font-semibold text-slate-900">
                  Setting Up Automatic Sync
                </h2>
                <p className="text-sm text-slate-500">
                  Configure daily automatic performance sync
                </p>
              </div>
            </div>
            {expandedSection === "cron" ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedSection === "cron" && (
            <div className="px-6 pb-6 border-t border-slate-100">
              <div className="mt-4 space-y-4">
                <p className="text-slate-600">
                  Set up automatic syncing to keep your ad performance data up-to-date without manual intervention.
                </p>

                {/* Option 1: cron-job.org */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                    Using cron-job.org (Recommended)
                  </h3>
                  <ol className="text-sm text-slate-600 space-y-2 ml-8 list-decimal">
                    <li>Create a free account at <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">cron-job.org</a></li>
                    <li>Click "Create Cronjob"</li>
                    <li>Configure with these settings:</li>
                  </ol>

                  <div className="bg-slate-900 rounded-lg p-4 mt-3 ml-8 text-sm">
                    <div className="grid gap-2">
                      <div className="flex">
                        <span className="text-slate-500 w-24">URL:</span>
                        <span className="text-green-400">{`https://your-domain.com/api/cron/sync-meta-performance`}</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-500 w-24">Method:</span>
                        <span className="text-amber-400">POST</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-500 w-24">Schedule:</span>
                        <span className="text-blue-400">0 */6 * * *</span>
                        <span className="text-slate-500 ml-2">(every 6 hours)</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-500 w-24">Header:</span>
                        <span className="text-purple-400">Authorization: Bearer YOUR_CRON_SECRET</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option 2: Vercel Cron */}
                <div className="border border-slate-200 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                    Using Vercel Cron
                  </h3>
                  <p className="text-sm text-slate-600 ml-8 mb-3">
                    Add to your <code className="bg-slate-100 px-1 rounded">vercel.json</code>:
                  </p>
                  <div className="bg-slate-900 rounded-lg p-4 ml-8">
                    <pre className="text-sm text-slate-300 overflow-x-auto">
{`{
  "crons": [
    {
      "path": "/api/cron/sync-meta-performance",
      "schedule": "0 */6 * * *"
    }
  ]
}`}
                    </pre>
                  </div>
                </div>

                {/* CRON_SECRET */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-amber-900">Security: Set Your CRON_SECRET</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Add a <code className="bg-amber-100 px-1 rounded">CRON_SECRET</code> to your .env file to prevent unauthorized access to the sync endpoint.
                        Generate a secure random string for production.
                      </p>
                      <div className="bg-slate-900 rounded-lg p-3 mt-2">
                        <code className="text-green-400 text-sm">
                          CRON_SECRET=your-secure-random-string-here
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section: Troubleshooting */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6">
          <button
            onClick={() => toggleSection("troubleshooting")}
            className="w-full px-6 py-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
              <div className="text-left">
                <h2 className="text-lg font-semibold text-slate-900">
                  Troubleshooting
                </h2>
                <p className="text-sm text-slate-500">
                  Common issues and how to fix them
                </p>
              </div>
            </div>
            {expandedSection === "troubleshooting" ? (
              <ChevronUp className="h-5 w-5 text-slate-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-slate-400" />
            )}
          </button>

          {expandedSection === "troubleshooting" && (
            <div className="px-6 pb-6 border-t border-slate-100">
              <div className="mt-4 space-y-4">
                {/* Error 1 */}
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="font-semibold text-slate-900">"Invalid OAuth access token"</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>Cause:</strong> Token is expired, malformed, or copied incorrectly.
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Fix:</strong> Generate a new System User token and make sure to copy the entire token string.
                  </p>
                </div>

                {/* Error 2 */}
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="font-semibold text-slate-900">"(#100) Missing permissions"</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>Cause:</strong> Token doesn't have required permissions.
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Fix:</strong> Regenerate token with ads_management, ads_read, and business_management permissions.
                  </p>
                </div>

                {/* Error 3 */}
                <div className="border-l-4 border-red-500 pl-4">
                  <h3 className="font-semibold text-slate-900">"Object with ID does not exist"</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>Cause:</strong> Ad Account ID is wrong or missing the act_ prefix.
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Fix:</strong> Make sure META_AD_ACCOUNT_ID starts with "act_" (e.g., act_123456789).
                  </p>
                </div>

                {/* Error 4 */}
                <div className="border-l-4 border-amber-500 pl-4">
                  <h3 className="font-semibold text-slate-900">No campaigns showing</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>Cause:</strong> Campaigns exist in Meta but haven't been imported.
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Fix:</strong> Go to <Link href="/admin/ads/setup" className="text-blue-600 hover:underline">Setup Wizard</Link> and click "Import Campaigns".
                  </p>
                </div>

                {/* Error 5 */}
                <div className="border-l-4 border-amber-500 pl-4">
                  <h3 className="font-semibold text-slate-900">Sync shows 0 campaigns updated</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>Cause:</strong> Campaigns in database don't have metaCampaignId linked.
                  </p>
                  <p className="text-sm text-slate-600">
                    <strong>Fix:</strong> Import campaigns from Meta first, then run sync to pull performance data.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Links */}
        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">Useful Links</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <a
              href="https://developers.facebook.com/docs/marketing-api"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              Marketing API Documentation
            </a>
            <a
              href="https://developers.facebook.com/tools/explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              Graph API Explorer
            </a>
            <a
              href="https://business.facebook.com/settings/info"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              Business Manager Settings
            </a>
            <a
              href="https://business.facebook.com/events_manager"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" />
              Events Manager (Pixel)
            </a>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
