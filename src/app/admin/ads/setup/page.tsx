"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Download,
  Database,
  Zap,
  Key,
  Globe,
  Target,
  Settings,
  HelpCircle,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface EnvStatus {
  meta: {
    variables: Record<string, boolean>;
    configured: number;
    total: number;
    ready: boolean;
  };
  openai: {
    variables: Record<string, boolean>;
    configured: number;
    total: number;
    ready: boolean;
  };
  summary: {
    canPublishToMeta: boolean;
    canUseAI: boolean;
    allConfigured: boolean;
  };
}

interface ConnectionTest {
  success: boolean;
  accountInfo?: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  };
  pixelInfo?: {
    id: string;
    name: string;
  };
  pageInfo?: {
    id: string;
    name: string;
  };
  campaignCount?: number;
  errors: string[];
}

interface ImportPreview {
  success: boolean;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    objective: string;
    adSetCount: number;
    exists: boolean;
  }>;
  totalAdSets: number;
  totalAds: number;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  campaignsImported: number;
  adSetsImported: number;
  adsImported: number;
  campaignsSkipped: number;
  adSetsSkipped: number;
  adsSkipped: number;
  errors: string[];
  duration: number;
}

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [connectionTest, setConnectionTest] = useState<ConnectionTest | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchEnvStatus();
  }, []);

  const fetchEnvStatus = async () => {
    try {
      const res = await fetch("/api/admin/env-status");
      const data = await res.json();
      if (!data.error) {
        setEnvStatus(data);
      }
    } catch (error) {
      console.error("Error fetching env status:", error);
    }
  };

  const testConnection = async () => {
    setLoading("test");
    setConnectionTest(null);
    try {
      const res = await fetch("/api/admin/ads/import?action=test");
      const data = await res.json();
      setConnectionTest(data);
      if (data.success) {
        setCurrentStep(3);
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      setConnectionTest({
        success: false,
        errors: ["Failed to test connection"],
      });
    } finally {
      setLoading(null);
    }
  };

  const previewImport = async () => {
    setLoading("preview");
    setImportPreview(null);
    try {
      const res = await fetch("/api/admin/ads/import");
      const data = await res.json();
      setImportPreview(data.preview);
    } catch (error) {
      console.error("Error previewing import:", error);
    } finally {
      setLoading(null);
    }
  };

  const runImport = async (updateExisting: boolean = false) => {
    setLoading("import");
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/ads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ALL",
          includePaused: true,
          updateExisting,
        }),
      });
      const data = await res.json();
      setImportResult(data.result);
      if (data.result?.success) {
        setCurrentStep(4);
      }
    } catch (error) {
      console.error("Error running import:", error);
      setImportResult({
        success: false,
        campaignsImported: 0,
        adSetsImported: 0,
        adsImported: 0,
        campaignsSkipped: 0,
        adSetsSkipped: 0,
        adsSkipped: 0,
        errors: ["Failed to run import"],
        duration: 0,
      });
    } finally {
      setLoading(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    { id: 1, name: "Check Credentials", icon: Key },
    { id: 2, name: "Test Connection", icon: Zap },
    { id: 3, name: "Import Campaigns", icon: Download },
    { id: 4, name: "Complete", icon: Check },
  ];

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
            <Settings className="h-8 w-8 text-orange-500" />
            Meta Ads Setup Wizard
          </h1>
          <p className="text-slate-500 mt-2">
            Connect your Meta Ads account and import existing campaigns
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    currentStep > step.id
                      ? "bg-green-500 border-green-500 text-white"
                      : currentStep === step.id
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white border-slate-300 text-slate-400"
                  }`}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`hidden sm:block w-24 lg:w-32 h-1 mx-2 rounded ${
                      currentStep > step.id ? "bg-green-500" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <span
                key={step.id}
                className={`text-xs font-medium ${
                  currentStep >= step.id ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {step.name}
              </span>
            ))}
          </div>
        </div>

        {/* Step 1: Check Credentials */}
        {currentStep === 1 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Key className="h-6 w-6 text-orange-500" />
              Step 1: Check Environment Variables
            </h2>
            <p className="text-slate-600 mb-6">
              First, let's verify your Meta API credentials are configured in your environment variables.
            </p>

            {envStatus ? (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {Object.entries(envStatus.meta.variables).map(([key, configured]) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        configured
                          ? "bg-green-50 border-green-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {configured ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-mono text-sm">{key}</span>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          configured ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {configured ? "Configured" : "Missing"}
                      </span>
                    </div>
                  ))}
                </div>

                {!envStatus.summary.canPublishToMeta && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-amber-900">Missing Required Credentials</h3>
                        <p className="text-amber-700 text-sm mt-1">
                          You need to configure the following environment variables:
                        </p>
                        <ul className="list-disc list-inside text-amber-700 text-sm mt-2">
                          {!envStatus.meta.variables.META_ACCESS_TOKEN && (
                            <li><code>META_ACCESS_TOKEN</code> - Your System User access token</li>
                          )}
                          {!envStatus.meta.variables.META_AD_ACCOUNT_ID && (
                            <li><code>META_AD_ACCOUNT_ID</code> - Your Ad Account ID (with act_ prefix)</li>
                          )}
                          {!envStatus.meta.variables.META_PAGE_ID && (
                            <li><code>META_PAGE_ID</code> - Your Facebook Page ID</li>
                          )}
                        </ul>
                        <div className="mt-4 flex gap-2">
                          <a
                            href="/docs/META_ADS_COMPLETE_SETUP.md"
                            target="_blank"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-sm font-medium"
                          >
                            <HelpCircle className="h-4 w-4" />
                            Setup Guide
                          </a>
                          <a
                            href="https://business.facebook.com/settings"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm font-medium"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Meta Business Settings
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                  <button
                    onClick={fetchEnvStatus}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Status
                  </button>
                  <button
                    onClick={() => setCurrentStep(2)}
                    disabled={!envStatus.summary.canPublishToMeta}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Test Connection */}
        {currentStep === 2 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="h-6 w-6 text-orange-500" />
              Step 2: Test API Connection
            </h2>
            <p className="text-slate-600 mb-6">
              Let's verify that we can connect to Meta's API with your credentials.
            </p>

            {connectionTest ? (
              <div className="space-y-4">
                {/* Overall Status */}
                <div
                  className={`p-4 rounded-lg border ${
                    connectionTest.success
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {connectionTest.success ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <h3
                        className={`font-semibold ${
                          connectionTest.success ? "text-green-900" : "text-red-900"
                        }`}
                      >
                        {connectionTest.success
                          ? "Connection Successful!"
                          : "Connection Failed"}
                      </h3>
                      <p
                        className={`text-sm ${
                          connectionTest.success ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {connectionTest.success
                          ? "Your Meta API credentials are working correctly."
                          : connectionTest.errors.join(", ")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connection Details */}
                {connectionTest.success && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Ad Account */}
                    {connectionTest.accountInfo && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                          Ad Account
                        </div>
                        <div className="font-semibold text-slate-900">
                          {connectionTest.accountInfo.name}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          ID: {connectionTest.accountInfo.id}
                        </div>
                        <div className="text-sm text-slate-500">
                          {connectionTest.accountInfo.currency} • {connectionTest.accountInfo.timezone}
                        </div>
                      </div>
                    )}

                    {/* Pixel */}
                    {connectionTest.pixelInfo && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                          Meta Pixel
                        </div>
                        <div className="font-semibold text-slate-900">
                          {connectionTest.pixelInfo.name}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          ID: {connectionTest.pixelInfo.id}
                        </div>
                      </div>
                    )}

                    {/* Page */}
                    {connectionTest.pageInfo && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                          Facebook Page
                        </div>
                        <div className="font-semibold text-slate-900">
                          {connectionTest.pageInfo.name}
                        </div>
                        <div className="text-sm text-slate-600 mt-1">
                          ID: {connectionTest.pageInfo.id}
                        </div>
                      </div>
                    )}

                    {/* Campaign Count */}
                    {typeof connectionTest.campaignCount === "number" && (
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                          Campaigns Found
                        </div>
                        <div className="font-semibold text-slate-900 text-2xl">
                          {connectionTest.campaignCount}
                        </div>
                        <div className="text-sm text-slate-500">
                          Ready to import
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Globe className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-6">
                  Click the button below to test your API connection
                </p>
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={testConnection}
                  disabled={loading === "test"}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  {loading === "test" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {connectionTest ? "Test Again" : "Test Connection"}
                </button>
                {connectionTest?.success && (
                  <button
                    onClick={() => {
                      setCurrentStep(3);
                      previewImport();
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Import Campaigns */}
        {currentStep === 3 && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Download className="h-6 w-6 text-orange-500" />
              Step 3: Import Campaigns
            </h2>
            <p className="text-slate-600 mb-6">
              Import your existing campaigns from Meta Ads Manager into the platform.
            </p>

            {loading === "preview" ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                <span className="ml-3 text-slate-600">Loading campaigns...</span>
              </div>
            ) : importPreview ? (
              <div className="space-y-4">
                {/* Preview Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {importPreview.campaigns.length}
                    </div>
                    <div className="text-sm text-blue-600">Campaigns</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-700">
                      {importPreview.totalAdSets}
                    </div>
                    <div className="text-sm text-purple-600">Ad Sets</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {importPreview.totalAds}
                    </div>
                    <div className="text-sm text-green-600">Ads</div>
                  </div>
                </div>

                {/* Campaigns List */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <h3 className="font-medium text-slate-900">Campaigns to Import</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {importPreview.campaigns.map((campaign) => (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <Target className="h-5 w-5 text-slate-400" />
                          <div>
                            <div className="font-medium text-slate-900">{campaign.name}</div>
                            <div className="text-xs text-slate-500">
                              {campaign.status} • {campaign.objective} • {campaign.adSetCount} ad sets
                            </div>
                          </div>
                        </div>
                        {campaign.exists ? (
                          <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded">
                            Already exists
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                            New
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Import Result */}
                {importResult && (
                  <div
                    className={`p-4 rounded-lg border ${
                      importResult.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {importResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      )}
                      <div>
                        <h3
                          className={`font-semibold ${
                            importResult.success ? "text-green-900" : "text-red-900"
                          }`}
                        >
                          {importResult.success ? "Import Complete!" : "Import had errors"}
                        </h3>
                        <p
                          className={`text-sm ${
                            importResult.success ? "text-green-700" : "text-red-700"
                          }`}
                        >
                          Imported: {importResult.campaignsImported} campaigns, {importResult.adSetsImported} ad sets, {importResult.adsImported} ads
                          <br />
                          Skipped: {importResult.campaignsSkipped} campaigns, {importResult.adSetsSkipped} ad sets, {importResult.adsSkipped} ads
                          <br />
                          Duration: {(importResult.duration / 1000).toFixed(1)}s
                        </p>
                        {importResult.errors.length > 0 && (
                          <div className="mt-2 text-sm text-red-600">
                            Errors: {importResult.errors.slice(0, 3).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Database className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">
                  Click "Preview Import" to see what campaigns will be imported
                </p>
                <button
                  onClick={previewImport}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                >
                  Preview Import
                </button>
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex gap-3">
                {importPreview && !importResult && (
                  <>
                    <button
                      onClick={previewImport}
                      disabled={loading === "preview"}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                    <button
                      onClick={() => runImport(false)}
                      disabled={loading === "import"}
                      className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      {loading === "import" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {loading === "import" ? "Importing..." : "Import Now"}
                    </button>
                  </>
                )}
                {importResult?.success && (
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 4 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Setup Complete!
            </h2>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              Your Meta Ads account is connected and your campaigns have been imported.
              You can now view, manage, and sync your ads from the dashboard.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="font-semibold text-slate-900">Campaigns Imported</div>
                <div className="text-2xl font-bold text-blue-700">
                  {importResult?.campaignsImported || 0}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <Database className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div className="font-semibold text-slate-900">Ad Sets Imported</div>
                <div className="text-2xl font-bold text-purple-700">
                  {importResult?.adSetsImported || 0}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <Zap className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="font-semibold text-slate-900">Ads Imported</div>
                <div className="text-2xl font-bold text-green-700">
                  {importResult?.adsImported || 0}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/admin/ads"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
              >
                View Campaigns
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => {
                  setCurrentStep(3);
                  setImportResult(null);
                  previewImport();
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Import Again
              </button>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-slate-500" />
            Need Help?
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Getting Your Credentials</h4>
              <p className="text-slate-500 mb-2">
                Follow our step-by-step guide to create a System User and generate an access token.
              </p>
              <Link
                href="/admin/ads/docs"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                Read Setup Documentation →
              </Link>
            </div>
            <div>
              <h4 className="font-medium text-slate-700 mb-1">Common Issues</h4>
              <ul className="text-slate-500 space-y-1">
                <li>• Token expired? Generate a new System User token</li>
                <li>• Missing permissions? Add ads_management scope</li>
                <li>• No campaigns? Check ad account ID has act_ prefix</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
