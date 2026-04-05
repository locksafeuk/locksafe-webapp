"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Target,
  Users,
  Image as ImageIcon,
  DollarSign,
  Eye,
  Rocket,
  RefreshCw,
  Check,
  Copy,
  Wand2,
  MousePointer,
  TrendingUp,
  Bell,
  ShoppingCart,
  Download,
  Info,
  Shield,
  FileText,
  Clock,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

// Goal options with Meta objective mapping
const GOALS = [
  {
    id: "LEADS",
    name: "Get Leads",
    description: "Collect job requests from customers needing locksmiths",
    icon: Target,
    pixelEvent: "Lead",
    color: "orange",
    bgColor: "bg-orange-100",
    iconColor: "text-orange-600",
    borderColor: "border-orange-500",
    selectedBg: "bg-orange-50",
  },
  {
    id: "SALES",
    name: "Drive Sales",
    description: "Get customers to book and pay for locksmith services",
    icon: ShoppingCart,
    pixelEvent: "Purchase",
    color: "green",
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
    borderColor: "border-green-500",
    selectedBg: "bg-green-50",
  },
  {
    id: "TRAFFIC",
    name: "Website Traffic",
    description: "Send people to learn about LockSafe's anti-fraud protection",
    icon: MousePointer,
    pixelEvent: "PageView",
    color: "blue",
    bgColor: "bg-blue-100",
    iconColor: "text-blue-600",
    borderColor: "border-blue-500",
    selectedBg: "bg-blue-50",
  },
  {
    id: "AWARENESS",
    name: "Brand Awareness",
    description: "Reach people who may need locksmiths in the future",
    icon: Bell,
    pixelEvent: "PageView",
    color: "purple",
    bgColor: "bg-purple-100",
    iconColor: "text-purple-600",
    borderColor: "border-purple-500",
    selectedBg: "bg-purple-50",
  },
];

// Pre-defined audience types based on LockSafe business context
const AUDIENCE_PRESETS = [
  {
    id: "emergency-lockout",
    name: "Emergency Lockout Victims",
    description: "People actively searching for locksmith help - high intent",
    bestFor: ["LEADS", "SALES"],
  },
  {
    id: "scam-aware",
    name: "Scam-Aware Customers",
    description: "People who've heard horror stories about cowboy locksmiths",
    bestFor: ["LEADS", "AWARENESS"],
  },
  {
    id: "security-upgraders",
    name: "Home Security Upgraders",
    description: "Homeowners wanting to improve their security",
    bestFor: ["LEADS", "TRAFFIC"],
  },
  {
    id: "new-movers",
    name: "New Homeowners / Movers",
    description: "Just moved and want to change locks",
    bestFor: ["LEADS"],
  },
  {
    id: "landlords",
    name: "Landlords & Property Managers",
    description: "Managing multiple properties, need reliable service",
    bestFor: ["LEADS", "SALES"],
  },
];

// Call to action options
const CTA_OPTIONS = [
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "GET_QUOTE", label: "Get Quote" },
  { value: "CONTACT_US", label: "Contact Us" },
  { value: "BOOK_NOW", label: "Book Now" },
  { value: "APPLY_NOW", label: "Apply Now" },
  { value: "DOWNLOAD", label: "Download" },
];

interface CopyVariation {
  primaryText: string;
  headline: string;
  description: string;
  callToAction: string;
  emotionalAngle: string;
  framework: string; // Which expert framework was used
  hookType?: string;
  reasoning: string;
}

interface AudienceSuggestion {
  name: string;
  description: string;
  demographics: {
    ageMin: number;
    ageMax: number;
    genders: string[];
  };
  interests: string[];
  behaviors: string[];
  estimatedReach: string;
  reasoning: string;
  suggestedBudget: {
    daily: number;
    currency: string;
  };
}

export default function CreateAdPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Step 1: Goal
  const [goal, setGoal] = useState<string>("");

  // Step 2: AI Copy
  const [additionalContext, setAdditionalContext] = useState("");
  const [targetAudiencePreset, setTargetAudiencePreset] = useState("");
  const [tone, setTone] = useState("professional");
  const [copyVariations, setCopyVariations] = useState<CopyVariation[]>([]);
  const [selectedCopy, setSelectedCopy] = useState<number[]>([]);

  // Step 3: Creative
  const [imageUrl, setImageUrl] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://locksafe.uk/request");

  // Step 4: Audience
  const [audienceSuggestions, setAudienceSuggestions] = useState<AudienceSuggestion[]>([]);
  const [selectedAudience, setSelectedAudience] = useState<number | null>(null);
  const [manualTargeting, setManualTargeting] = useState({
    locations: ["GB"],
    ageMin: 25,
    ageMax: 65,
    genders: ["all"],
    interests: [] as string[],
  });

  // Step 5: Budget
  const [campaignName, setCampaignName] = useState("");
  const [dailyBudget, setDailyBudget] = useState(20);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Step 6: Review
  const [publishToMeta, setPublishToMeta] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    campaign?: unknown;
    meta?: {
      published: boolean;
      campaignId: string | null;
    };
  } | null>(null);

  // Generate AI copy
  const generateCopy = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/admin/ai/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate",
          goal: goal.toLowerCase(),
          targetAudience: targetAudiencePreset
            ? AUDIENCE_PRESETS.find(a => a.id === targetAudiencePreset)?.name
            : undefined,
          tone,
          uniqueSellingPoints: additionalContext ? [additionalContext] : undefined,
        }),
      });

      const data = await res.json();
      if (data.variations) {
        setCopyVariations(data.variations);
        setSelectedCopy([0]);
      }
    } catch (error) {
      console.error("Error generating copy:", error);
    } finally {
      setAiLoading(false);
    }
  };

  // Generate audience suggestions
  const generateAudiences = async () => {
    setAiLoading(true);
    try {
      setAudienceSuggestions([
        {
          name: "Emergency Service Seekers",
          description: "People actively looking for locksmith services - high intent, needs protection assurance",
          demographics: { ageMin: 25, ageMax: 55, genders: ["all"] },
          interests: ["Home security", "Property ownership", "DIY"],
          behaviors: ["Online buyers", "Mobile shoppers", "Local search users"],
          estimatedReach: "moderate",
          reasoning: "High-intent audience likely to convert. Lead with speed + protection messaging.",
          suggestedBudget: { daily: 30, currency: "GBP" },
        },
        {
          name: "Scam-Aware Homeowners",
          description: "Property owners who've heard about or experienced locksmith scams",
          demographics: { ageMin: 30, ageMax: 65, genders: ["all"] },
          interests: ["Home improvement", "Consumer rights", "Security systems"],
          behaviors: ["Engaged shoppers", "Research-heavy buyers"],
          estimatedReach: "narrow",
          reasoning: "Perfect for anti-fraud messaging. Lead with 'UK's first anti-fraud platform'.",
          suggestedBudget: { daily: 25, currency: "GBP" },
        },
        {
          name: "Recent Movers & New Homeowners",
          description: "People who recently moved and need lock changes for security",
          demographics: { ageMin: 25, ageMax: 45, genders: ["all"] },
          interests: ["Moving services", "New home", "Furniture", "Real estate"],
          behaviors: ["Recently moved", "New homeowner"],
          estimatedReach: "narrow",
          reasoning: "High relevance for lock replacement. Lead with transparency + documentation.",
          suggestedBudget: { daily: 20, currency: "GBP" },
        },
      ]);
      setSelectedAudience(0);
    } catch (error) {
      console.error("Error generating audiences:", error);
    } finally {
      setAiLoading(false);
    }
  };

  // Submit campaign
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const selectedCopyData = selectedCopy.map(i => copyVariations[i]);
      const audience = selectedAudience !== null ? audienceSuggestions[selectedAudience] : null;

      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName || `${GOALS.find(g => g.id === goal)?.name} Campaign`,
          objective: goal,
          dailyBudget,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          targeting: audience ? {
            description: audience.description,
            geo_locations: { countries: manualTargeting.locations },
            age_min: audience.demographics.ageMin,
            age_max: audience.demographics.ageMax,
            interests: audience.interests.map(i => ({ name: i })),
          } : {
            geo_locations: { countries: manualTargeting.locations },
            age_min: manualTargeting.ageMin,
            age_max: manualTargeting.ageMax,
          },
          primaryText: selectedCopyData[0]?.primaryText,
          headline: selectedCopyData[0]?.headline,
          description: selectedCopyData[0]?.description,
          callToAction: selectedCopyData[0]?.callToAction,
          imageUrl,
          destinationUrl,
          useAI: true,
          publishToMeta,
          status: publishToMeta ? "ACTIVE" : "DRAFT",
        }),
      });

      const data = await res.json();
      setResult(data);

      if (data.success) {
        setStep(7);
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getEmotionalAngleStyle = (angle: string) => {
    const styles: Record<string, string> = {
      urgency: "bg-red-100 text-red-700 border-red-200",
      fear: "bg-orange-100 text-orange-700 border-orange-200",
      trust: "bg-green-100 text-green-700 border-green-200",
      control: "bg-blue-100 text-blue-700 border-blue-200",
      benefit: "bg-purple-100 text-purple-700 border-purple-200",
    };
    return styles[angle] || "bg-slate-100 text-slate-700 border-slate-200";
  };

  const getFrameworkStyle = (framework: string) => {
    const normalizedFramework = framework.toLowerCase();
    const styles: Record<string, { bg: string; text: string; icon: string }> = {
      "justin welsh": { bg: "bg-amber-100", text: "text-amber-800", icon: "JW" },
      "russell brunson": { bg: "bg-rose-100", text: "text-rose-800", icon: "RB" },
      "nicholas cole": { bg: "bg-cyan-100", text: "text-cyan-800", icon: "NC" },
      "simon sinek": { bg: "bg-violet-100", text: "text-violet-800", icon: "SS" },
    };
    return styles[normalizedFramework] || { bg: "bg-slate-100", text: "text-slate-700", icon: "AI" };
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">What's your campaign goal?</h2>
              <p className="text-slate-500 text-sm">Choose the primary objective for your LockSafe UK ad campaign</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {GOALS.map((g) => {
                const Icon = g.icon;
                const isSelected = goal === g.id;

                return (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? `${g.borderColor} ${g.selectedBg}`
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 ${g.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-6 w-6 ${g.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-900">{g.name}</h3>
                          {isSelected && (
                            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{g.description}</p>
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md font-mono">
                            Pixel: {g.pixelEvent}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-500" />
                AI Ad Copy Generator
              </h2>
              <p className="text-slate-500 text-sm">Our AI already knows LockSafe UK - just configure and generate!</p>
            </div>

            {/* AI Context Info Card - Elite Copywriting Frameworks */}
            <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-900 text-sm">Elite Copywriting Frameworks</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    AI generates 4 variations using proven strategies from master copywriters:
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    <div className="px-2 py-2 bg-amber-100 rounded-lg border border-amber-200">
                      <div className="font-bold text-amber-800 text-xs">Justin Welsh</div>
                      <div className="text-[10px] text-amber-700 mt-0.5">Pattern Interrupts & Hooks</div>
                    </div>
                    <div className="px-2 py-2 bg-rose-100 rounded-lg border border-rose-200">
                      <div className="font-bold text-rose-800 text-xs">Russell Brunson</div>
                      <div className="text-[10px] text-rose-700 mt-0.5">Hook-Story-Offer</div>
                    </div>
                    <div className="px-2 py-2 bg-cyan-100 rounded-lg border border-cyan-200">
                      <div className="font-bold text-cyan-800 text-xs">Nicholas Cole</div>
                      <div className="text-[10px] text-cyan-700 mt-0.5">Category Design</div>
                    </div>
                    <div className="px-2 py-2 bg-violet-100 rounded-lg border border-violet-200">
                      <div className="font-bold text-violet-800 text-xs">Simon Sinek</div>
                      <div className="text-[10px] text-violet-700 mt-0.5">Start with Why</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 flex items-center gap-1">
                      <Shield className="h-3 w-3 text-green-600" /> Anti-fraud positioning
                    </span>
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 flex items-center gap-1">
                      <FileText className="h-3 w-3 text-blue-600" /> Specific proof points
                    </span>
                    <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-orange-600" /> Risk reversal close
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Target Audience Preset
                </label>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {AUDIENCE_PRESETS.filter(a => a.bestFor.includes(goal)).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setTargetAudiencePreset(preset.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        targetAudiencePreset === preset.id
                          ? "border-orange-500 bg-orange-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="font-medium text-sm text-slate-900">{preset.name}</div>
                      <div className="text-xs text-slate-500 mt-1">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Tone
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="professional">Professional & Trustworthy</option>
                    <option value="urgent">Urgent & Direct</option>
                    <option value="friendly">Friendly & Approachable</option>
                    <option value="casual">Casual & Relatable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Context (optional)
                  </label>
                  <input
                    type="text"
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="e.g., Promotion: Free security check"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              <button
                onClick={generateCopy}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 disabled:from-slate-300 disabled:to-slate-400 text-white font-semibold rounded-xl transition-all shadow-sm"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating Elite Ad Copy...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate 4 Elite Copy Variations
                  </>
                )}
              </button>
              <p className="text-xs text-center text-slate-500 mt-2">
                Uses frameworks from Welsh, Brunson, Cole & Sinek
              </p>
            </div>

            {/* Variations */}
            {copyVariations.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Select copy variations</h3>
                  <button
                    onClick={generateCopy}
                    disabled={aiLoading}
                    className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {copyVariations.map((variation, idx) => {
                    const isSelected = selectedCopy.includes(idx);
                    const frameworkStyle = getFrameworkStyle(variation.framework || "AI");

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCopy(selectedCopy.filter(i => i !== idx));
                          } else {
                            setSelectedCopy([...selectedCopy, idx]);
                          }
                        }}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-green-500 bg-green-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        {/* Framework & Angle badges */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {/* Framework badge */}
                            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${frameworkStyle.bg} ${frameworkStyle.text}`}>
                              {frameworkStyle.icon}
                            </span>
                            {/* Emotional angle badge */}
                            <span className={`px-2 py-0.5 text-xs rounded-full border capitalize ${getEmotionalAngleStyle(variation.emotionalAngle)}`}>
                              {variation.emotionalAngle}
                            </span>
                            {/* Hook type badge */}
                            {variation.hookType && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                                {variation.hookType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(variation.primaryText);
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                              title="Copy text"
                            >
                              <Copy className="h-3.5 w-3.5 text-slate-400" />
                            </button>
                            {isSelected && (
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Framework name */}
                        {variation.framework && (
                          <div className="text-xs text-slate-400 mb-2">
                            <span className="font-medium">{variation.framework}</span> framework
                          </div>
                        )}

                        <div className="space-y-3">
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{variation.primaryText}</p>
                          <div className="pt-3 border-t border-slate-100">
                            <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider">Headline</div>
                            <div className="font-semibold text-slate-900">{variation.headline}</div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">CTA:</span>
                            <span className="font-medium text-slate-700">{variation.callToAction}</span>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs text-slate-500 italic">{variation.reasoning}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-500" />
                Creative & Destination
              </h2>
              <p className="text-slate-500 text-sm">Add your image and set the landing page URL</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ad Image
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 bg-white text-center">
                  {imageUrl ? (
                    <div className="space-y-3">
                      <img
                        src={imageUrl}
                        alt="Ad preview"
                        className="max-h-48 mx-auto rounded-lg shadow-sm"
                      />
                      <button
                        onClick={() => setImageUrl("")}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto">
                        <ImageIcon className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 text-sm">Enter image URL below</p>
                      <input
                        type="text"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Recommended: 1080x1080px (1:1) or 1200x628px (1.91:1)
                </p>
              </div>

              {/* Destination URL */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Destination URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    placeholder="https://locksafe.uk/request"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    UTM parameters will be added automatically
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Auto-configured tracking
                  </div>
                  <ul className="space-y-1.5 text-xs text-green-700">
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      UTM parameters (source, medium, campaign, content)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      Meta Pixel tracking ({GOALS.find(g => g.id === goal)?.pixelEvent} event)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      Conversions API (server-side)
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3" />
                      fbclid capture for attribution
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Audience Targeting
              </h2>
              <p className="text-slate-500 text-sm">Choose your target audience or let AI suggest options</p>
            </div>

            {/* AI Suggestions */}
            {audienceSuggestions.length === 0 ? (
              <button
                onClick={generateAudiences}
                disabled={aiLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-slate-50 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl transition-colors"
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing audiences...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate AI Audience Suggestions
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">AI Suggested Audiences</h3>
                  <button
                    onClick={generateAudiences}
                    disabled={aiLoading}
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {audienceSuggestions.map((audience, idx) => {
                    const isSelected = selectedAudience === idx;

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedAudience(idx)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-purple-500 bg-purple-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            audience.estimatedReach === "narrow"
                              ? "bg-orange-100 text-orange-700"
                              : audience.estimatedReach === "moderate"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}>
                            {audience.estimatedReach} reach
                          </span>
                          {isSelected && (
                            <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>

                        <h4 className="font-semibold text-slate-900 mb-1">{audience.name}</h4>
                        <p className="text-xs text-slate-500 mb-3">{audience.description}</p>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Age:</span>
                            <span className="text-slate-700 font-medium">
                              {audience.demographics.ageMin}-{audience.demographics.ageMax}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Interests:</span>
                            <span className="text-slate-700 font-medium text-right">
                              {audience.interests.slice(0, 2).join(", ")}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between">
                            <span className="text-slate-400">Suggested:</span>
                            <span className="text-green-600 font-bold">
                              £{audience.suggestedBudget.daily}/day
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Targeting */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">Or set targeting manually</h3>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Location
                  </label>
                  <select
                    value={manualTargeting.locations[0]}
                    onChange={(e) => setManualTargeting({
                      ...manualTargeting,
                      locations: [e.target.value],
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="GB">United Kingdom</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Age Range
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={manualTargeting.ageMin}
                      onChange={(e) => setManualTargeting({
                        ...manualTargeting,
                        ageMin: parseInt(e.target.value),
                      })}
                      min={18}
                      max={65}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="number"
                      value={manualTargeting.ageMax}
                      onChange={(e) => setManualTargeting({
                        ...manualTargeting,
                        ageMax: parseInt(e.target.value),
                      })}
                      min={18}
                      max={65}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={manualTargeting.genders[0]}
                    onChange={(e) => setManualTargeting({
                      ...manualTargeting,
                      genders: [e.target.value],
                    })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="all">All</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Budget & Schedule
              </h2>
              <p className="text-slate-500 text-sm">Set your campaign budget and timeline</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder={`${GOALS.find(g => g.id === goal)?.name} Campaign`}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Daily Budget (GBP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">£</span>
                    <input
                      type="number"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(parseFloat(e.target.value))}
                      min={1}
                      step={1}
                      className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Minimum £1/day. Recommended: £20-50/day for testing
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Start Date (optional)
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    End Date (optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Leave empty to run continuously
                  </p>
                </div>
              </div>
            </div>

            {/* Budget Calculator */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Budget Preview</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">£{dailyBudget}</div>
                  <div className="text-xs text-slate-500 mt-1">Per Day</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">£{(dailyBudget * 7).toFixed(0)}</div>
                  <div className="text-xs text-slate-500 mt-1">Per Week</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="text-2xl font-bold text-slate-900">£{(dailyBudget * 30).toFixed(0)}</div>
                  <div className="text-xs text-slate-500 mt-1">Per Month</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Eye className="h-5 w-5 text-slate-600" />
                Review & Publish
              </h2>
              <p className="text-slate-500 text-sm">Review your campaign settings before publishing</p>
            </div>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Goal */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Goal</div>
                <div className="font-semibold text-slate-900">
                  {GOALS.find(g => g.id === goal)?.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Pixel event: <span className="font-mono bg-slate-100 px-1 rounded">{GOALS.find(g => g.id === goal)?.pixelEvent}</span>
                </div>
              </div>

              {/* Budget */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Budget</div>
                <div className="font-semibold text-slate-900">
                  £{dailyBudget}/day
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {startDate ? `Starting ${startDate}` : "Starts immediately"}
                </div>
              </div>

              {/* Copy */}
              {selectedCopy.length > 0 && copyVariations[selectedCopy[0]] && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 md:col-span-2">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Selected Ad Copy</div>
                  <div className="space-y-2">
                    <p className="text-slate-700 text-sm">{copyVariations[selectedCopy[0]].primaryText}</p>
                    <div className="font-semibold text-slate-900">
                      {copyVariations[selectedCopy[0]].headline}
                    </div>
                  </div>
                </div>
              )}

              {/* Audience */}
              {selectedAudience !== null && audienceSuggestions[selectedAudience] && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Target Audience</div>
                  <div className="font-semibold text-slate-900">
                    {audienceSuggestions[selectedAudience].name}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Ages {audienceSuggestions[selectedAudience].demographics.ageMin}-{audienceSuggestions[selectedAudience].demographics.ageMax}
                  </div>
                </div>
              )}

              {/* Destination */}
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Destination URL</div>
                <div className="font-semibold text-slate-900 text-sm truncate">
                  {destinationUrl}
                </div>
              </div>
            </div>

            {/* Auto Tracking Info */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-green-800">
                    Full Tracking Auto-Configured
                  </div>
                  <ul className="text-sm text-green-700 mt-2 space-y-1">
                    <li>Meta Pixel will track {GOALS.find(g => g.id === goal)?.pixelEvent} events</li>
                    <li>Conversions API will send server-side events</li>
                    <li>UTM parameters: utm_source=facebook&utm_medium=paid</li>
                    <li>Event deduplication enabled</li>
                    <li>User matching with hashed PII</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Publish Options */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishToMeta}
                  onChange={(e) => setPublishToMeta(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    Publish to Meta Ads Manager
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    If enabled, this ad will be submitted to Facebook for review and will start running once approved.
                    Otherwise, it will be saved as a draft.
                  </p>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Creating Campaign...
                </>
              ) : publishToMeta ? (
                <>
                  <Rocket className="h-5 w-5" />
                  Publish to Meta
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  Save as Draft
                </>
              )}
            </button>
          </div>
        );

      case 7:
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Campaign Created Successfully!
            </h2>

            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              {result?.meta?.published
                ? "Your ad has been submitted to Meta for review. It usually takes 24 hours or less."
                : "Your campaign has been saved as a draft. You can publish it later from the dashboard."}
            </p>

            <div className="flex justify-center gap-4">
              <Link
                href="/admin/ads"
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => {
                  setStep(1);
                  setGoal("");
                  setCopyVariations([]);
                  setSelectedCopy([]);
                  setAudienceSuggestions([]);
                  setSelectedAudience(null);
                  setResult(null);
                }}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        );
    }
  };

  const steps = [
    { num: 1, label: "Goal" },
    { num: 2, label: "Copy" },
    { num: 3, label: "Creative" },
    { num: 4, label: "Audience" },
    { num: 5, label: "Budget" },
    { num: 6, label: "Review" },
  ];

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin/ads"
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Create Ad Campaign</h1>
            <p className="text-slate-500 text-sm">AI-powered ad creation for LockSafe UK</p>
          </div>
        </div>

        {/* Progress Steps */}
        {step < 7 && (
          <div className="mb-8">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {steps.map((s, idx) => (
                <div key={s.num} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        step > s.num
                          ? "bg-green-500 text-white"
                          : step === s.num
                          ? "bg-orange-500 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {step > s.num ? <Check className="h-4 w-4" /> : s.num}
                    </div>
                    <span className={`text-xs mt-1 hidden sm:block ${
                      step >= s.num ? "text-slate-700" : "text-slate-400"
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 5 && (
                    <div className={`w-8 sm:w-12 lg:w-16 h-0.5 mx-1 ${
                      step > s.num ? "bg-green-500" : "bg-slate-200"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 max-w-4xl mx-auto">
          {renderStep()}
        </div>

        {/* Navigation */}
        {step < 7 && (
          <div className="flex justify-between mt-6 max-w-4xl mx-auto">
            <button
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {step < 6 && (
              <button
                onClick={() => setStep(Math.min(6, step + 1))}
                disabled={
                  (step === 1 && !goal) ||
                  (step === 2 && selectedCopy.length === 0) ||
                  (step === 3 && !destinationUrl)
                }
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 text-white font-semibold rounded-lg transition-colors"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
