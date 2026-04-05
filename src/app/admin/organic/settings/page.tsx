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

export default function AutopilotSettingsPage() {
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualGenerating, setManualGenerating] = useState(false);

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
  }, []);

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

          {/* Platform Settings */}
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Platform Settings</h2>
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
