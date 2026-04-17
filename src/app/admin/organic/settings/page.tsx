"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Save,
  RefreshCw,
  Calendar,
  Clock,
  Bell,
  Facebook,
  Instagram,
  CheckCircle,
  Settings,
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";

interface AutopilotConfig {
  id: string;
  isEnabled: boolean;
  postsPerDay: number;
  generateAheadDays: number;
  requireApproval: boolean;
  publishToFacebook: boolean;
  publishToInstagram: boolean;
  publishTimes: Record<string, string[]>;
  pillarWeights: Record<string, number>;
  preferredFrameworks: string[];
  emotionalAngleRotation: string[];
  notifyOnGeneration: boolean;
  notifyOnPublish: boolean;
  notificationEmail: string | null;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const FRAMEWORKS = [
  { id: "justin-welsh", name: "Justin Welsh", description: "Hooks & pattern interrupts" },
  { id: "russell-brunson", name: "Russell Brunson", description: "Storytelling & engagement" },
  { id: "nicholas-cole", name: "Nicholas Cole", description: "Specificity & category design" },
  { id: "simon-sinek", name: "Simon Sinek", description: "Purpose-driven messaging" },
];

const EMOTIONAL_ANGLES = [
  { id: "trust", name: "Trust" },
  { id: "urgency", name: "Urgency" },
  { id: "control", name: "Control" },
  { id: "benefit", name: "Benefit" },
  { id: "fear", name: "Fear" },
  { id: "curiosity", name: "Curiosity" },
];

interface SocialAccount {
  id: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  accountId: string;
  accountName: string;
  accountHandle?: string;
  profileImage?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
}

export default function AutopilotSettingsPage() {
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualGenerating, setManualGenerating] = useState(false);

  // Social accounts state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountFormPlatform, setAccountFormPlatform] = useState<"FACEBOOK" | "INSTAGRAM">("FACEBOOK");
  const [accountFormData, setAccountFormData] = useState({
    accountId: "",
    accountName: "",
    accountHandle: "",
    accessToken: "",
    pageId: "",
    pageAccessToken: "",
  });

  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(2);
  const [generateAheadDays, setGenerateAheadDays] = useState(7);
  const [requireApproval, setRequireApproval] = useState(true);
  const [publishToFacebook, setPublishToFacebook] = useState(true);
  const [publishToInstagram, setPublishToInstagram] = useState(true);
  const [publishTimes, setPublishTimes] = useState<Record<string, string[]>>({});
  const [preferredFrameworks, setPreferredFrameworks] = useState<string[]>([]);
  const [emotionalAngleRotation, setEmotionalAngleRotation] = useState<string[]>([]);
  const [notifyOnGeneration, setNotifyOnGeneration] = useState(true);
  const [notifyOnPublish, setNotifyOnPublish] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("");

  useEffect(() => {
    fetchConfig();
    fetchSocialAccounts();
  }, []);

  const fetchSocialAccounts = async () => {
    try {
      const response = await fetch("/api/admin/organic/accounts");
      const data = await response.json();
      if (data.success) {
        setSocialAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Error fetching social accounts:", error);
    }
  };

  const handleAddAccount = async () => {
    if (!accountFormData.accountId || !accountFormData.accountName || !accountFormData.accessToken) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const response = await fetch("/api/admin/organic/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: accountFormPlatform,
          ...accountFormData,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowAccountForm(false);
        setAccountFormData({
          accountId: "",
          accountName: "",
          accountHandle: "",
          accessToken: "",
          pageId: "",
          pageAccessToken: "",
        });
        fetchSocialAccounts();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error adding account:", error);
      alert("Failed to add account");
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/organic/accounts?id=${accountId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        fetchSocialAccounts();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account");
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/admin/organic/autopilot");
      const data = await response.json();

      if (data.success && data.config) {
        const cfg = data.config;
        setConfig(cfg);
        setIsEnabled(cfg.isEnabled);
        setPostsPerDay(cfg.postsPerDay);
        setGenerateAheadDays(cfg.generateAheadDays);
        setRequireApproval(cfg.requireApproval);
        setPublishToFacebook(cfg.publishToFacebook);
        setPublishToInstagram(cfg.publishToInstagram);
        setPublishTimes(cfg.publishTimes || {});
        setPreferredFrameworks(cfg.preferredFrameworks || []);
        setEmotionalAngleRotation(cfg.emotionalAngleRotation || []);
        setNotifyOnGeneration(cfg.notifyOnGeneration);
        setNotifyOnPublish(cfg.notifyOnPublish);
        setNotificationEmail(cfg.notificationEmail || "");
      } else {
        // Set defaults
        setPublishTimes({
          monday: ["09:00", "18:00"],
          tuesday: ["09:00", "18:00"],
          wednesday: ["09:00", "18:00"],
          thursday: ["09:00", "18:00"],
          friday: ["09:00", "18:00"],
          saturday: ["10:00", "15:00"],
          sunday: ["10:00", "15:00"],
        });
        setPreferredFrameworks(FRAMEWORKS.map(f => f.id));
        setEmotionalAngleRotation(EMOTIONAL_ANGLES.map(a => a.id));
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/organic/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isEnabled,
          postsPerDay,
          generateAheadDays,
          requireApproval,
          publishToFacebook,
          publishToInstagram,
          publishTimes,
          preferredFrameworks,
          emotionalAngleRotation,
          notifyOnGeneration,
          notifyOnPublish,
          notificationEmail: notificationEmail || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert("Settings saved successfully!");
        setConfig(data.config);
      } else {
        alert(`Failed to save: ${data.error}`);
      }
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleManualGenerate = async () => {
    setManualGenerating(true);
    try {
      // No need to pass authorization header - the route checks admin cookies
      const response = await fetch("/api/cron/generate-organic", {
        method: "POST",
        credentials: "include", // Include cookies for admin auth
      });

      const data = await response.json();
      if (data.success) {
        alert(`Generated ${data.generated} posts!`);
      } else {
        alert(`Generation failed: ${data.error || data.message}`);
      }
    } catch (error) {
      console.error("Error triggering generation:", error);
      alert("Failed to trigger generation");
    } finally {
      setManualGenerating(false);
    }
  };

  const toggleFramework = (id: string) => {
    if (preferredFrameworks.includes(id)) {
      setPreferredFrameworks(preferredFrameworks.filter(f => f !== id));
    } else {
      setPreferredFrameworks([...preferredFrameworks, id]);
    }
  };

  const toggleAngle = (id: string) => {
    if (emotionalAngleRotation.includes(id)) {
      setEmotionalAngleRotation(emotionalAngleRotation.filter(a => a !== id));
    } else {
      setEmotionalAngleRotation([...emotionalAngleRotation, id]);
    }
  };

  const updateDayTimes = (day: string, times: string[]) => {
    setPublishTimes({ ...publishTimes, [day]: times });
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

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/organic">
            <button type="button" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Autopilot Settings</h1>
            <p className="text-slate-600">Configure automatic content generation and publishing</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Master Toggle */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isEnabled ? "bg-green-100" : "bg-slate-100"}`}>
                  <Zap className={`w-6 h-6 ${isEnabled ? "text-green-600" : "text-slate-400"}`} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Autopilot Mode</h2>
                  <p className="text-slate-600">
                    {isEnabled
                      ? "AI is automatically generating and scheduling content"
                      : "Enable to let AI generate and schedule content automatically"
                    }
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Generation Settings */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-slate-900">Generation Settings</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Posts Per Day
                </label>
                <select
                  value={postsPerDay}
                  onChange={(e) => setPostsPerDay(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={1}>1 post</option>
                  <option value={2}>2 posts</option>
                  <option value={3}>3 posts</option>
                  <option value={4}>4 posts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Generate Ahead (Days)
                </label>
                <select
                  value={generateAheadDays}
                  onChange={(e) => setGenerateAheadDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireApproval}
                  onChange={(e) => setRequireApproval(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-slate-100 border-slate-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">
                  Require manual approval before publishing
                </span>
              </label>
            </div>
          </div>

          {/* Social Media Accounts */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Connected Accounts</h2>
              </div>
              <Button
                onClick={() => setShowAccountForm(!showAccountForm)}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Account
              </Button>
            </div>

            {/* Account Form */}
            {showAccountForm && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-slate-900 mb-3">Connect New Account</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Platform
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountFormPlatform("FACEBOOK")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                          accountFormPlatform === "FACEBOOK"
                            ? "bg-blue-100 border-blue-500 text-blue-700"
                            : "bg-white border-slate-300 text-slate-600"
                        }`}
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountFormPlatform("INSTAGRAM")}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                          accountFormPlatform === "INSTAGRAM"
                            ? "bg-pink-100 border-pink-500 text-pink-700"
                            : "bg-white border-slate-300 text-slate-600"
                        }`}
                      >
                        <Instagram className="w-4 h-4" />
                        Instagram
                      </button>
                    </div>
                  </div>

                  {accountFormPlatform === "FACEBOOK" ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Page ID *
                        </label>
                        <input
                          type="text"
                          value={accountFormData.pageId}
                          onChange={(e) => setAccountFormData({ ...accountFormData, pageId: e.target.value, accountId: e.target.value })}
                          placeholder="123456789012345"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Page Name *
                        </label>
                        <input
                          type="text"
                          value={accountFormData.accountName}
                          onChange={(e) => setAccountFormData({ ...accountFormData, accountName: e.target.value })}
                          placeholder="LockSafe UK"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Page Access Token *
                        </label>
                        <input
                          type="password"
                          value={accountFormData.pageAccessToken || accountFormData.accessToken}
                          onChange={(e) => setAccountFormData({ ...accountFormData, pageAccessToken: e.target.value, accessToken: e.target.value })}
                          placeholder="EAAxxxxxxxx..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Get from: <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Graph API Explorer</a>
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Instagram Business Account ID *
                        </label>
                        <input
                          type="text"
                          value={accountFormData.accountId}
                          onChange={(e) => setAccountFormData({ ...accountFormData, accountId: e.target.value })}
                          placeholder="17841400000000000"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Account Name *
                        </label>
                        <input
                          type="text"
                          value={accountFormData.accountName}
                          onChange={(e) => setAccountFormData({ ...accountFormData, accountName: e.target.value })}
                          placeholder="@locksafeuk"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Access Token *
                        </label>
                        <input
                          type="password"
                          value={accountFormData.accessToken}
                          onChange={(e) => setAccountFormData({ ...accountFormData, accessToken: e.target.value })}
                          placeholder="EAAxxxxxxxx..."
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddAccount}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                    <Button
                      onClick={() => setShowAccountForm(false)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Connected Accounts List */}
            {socialAccounts.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="text-slate-600 mb-1">No accounts connected</p>
                <p className="text-sm text-slate-500">
                  Connect your Facebook Page or Instagram Business account to start publishing
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {socialAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      {account.platform === "FACEBOOK" ? (
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Facebook className="w-5 h-5 text-blue-600" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
                          <Instagram className="w-5 h-5 text-pink-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{account.accountName}</p>
                        <p className="text-xs text-slate-500">
                          {account.platform} • {account.isActive ? "Active" : "Inactive"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(account.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Platform Settings */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Publishing Platforms</h2>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishToFacebook}
                  onChange={(e) => setPublishToFacebook(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-slate-100 border-slate-300 rounded focus:ring-blue-500"
                />
                <Facebook className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-slate-700">Facebook</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishToInstagram}
                  onChange={(e) => setPublishToInstagram(e.target.checked)}
                  className="w-4 h-4 text-pink-600 bg-slate-100 border-slate-300 rounded focus:ring-pink-500"
                />
                <Instagram className="w-5 h-5 text-pink-600" />
                <span className="text-sm text-slate-700">Instagram</span>
              </label>
            </div>
          </div>

          {/* Copywriting Frameworks */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-slate-900">Copywriting Frameworks</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Select which frameworks the AI should rotate between when generating content.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              {FRAMEWORKS.map((framework) => (
                <button
                  key={framework.id}
                  type="button"
                  onClick={() => toggleFramework(framework.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    preferredFrameworks.includes(framework.id)
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    preferredFrameworks.includes(framework.id)
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100"
                  }`}>
                    {preferredFrameworks.includes(framework.id) && (
                      <CheckCircle className="w-3 h-3" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{framework.name}</p>
                    <p className="text-xs text-slate-500">{framework.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Emotional Angles */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-slate-900">Emotional Angles</h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Select which emotional angles to rotate between.
            </p>

            <div className="flex flex-wrap gap-2">
              {EMOTIONAL_ANGLES.map((angle) => (
                <button
                  key={angle.id}
                  type="button"
                  onClick={() => toggleAngle(angle.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    emotionalAngleRotation.includes(angle.id)
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {angle.name}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
            </div>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnGeneration}
                  onChange={(e) => setNotifyOnGeneration(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-slate-100 border-slate-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">Notify when content is generated</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyOnPublish}
                  onChange={(e) => setNotifyOnPublish(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-slate-100 border-slate-300 rounded focus:ring-purple-500"
                />
                <span className="text-sm text-slate-700">Notify when posts are published</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notification Email
              </label>
              <input
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="admin@locksafe.co.uk"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 justify-between">
            <Button
              onClick={handleManualGenerate}
              disabled={manualGenerating}
              variant="outline"
              className="border-purple-300 text-purple-700"
            >
              {manualGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run Generation Now
                </>
              )}
            </Button>

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
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
