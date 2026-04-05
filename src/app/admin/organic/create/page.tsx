"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  Calendar,
  Hash,
  Send,
  Save,
  Eye,
  CheckCircle,
  Facebook,
  Instagram,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";

interface GeneratedPost {
  content: string;
  headline: string;
  hook: string;
  hookType: string;
  hashtags: string[];
  framework: string;
  emotionalAngle: string;
  pillar: string;
  callToAction?: string;
  reasoning: string;
  imagePrompt?: string;
}

interface Pillar {
  id: string;
  name: string;
  displayName: string;
  description: string;
  color: string;
  hashtags: string[];
}

export default function CreateOrganicPostPage() {
  const router = useRouter();
  const [step, setStep] = useState<"compose" | "preview">("compose");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [generatedOptions, setGeneratedOptions] = useState<GeneratedPost[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Form state
  const [content, setContent] = useState("");
  const [headline, setHeadline] = useState("");
  const [hook, setHook] = useState("");
  const [hookType, setHookType] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedPillar, setSelectedPillar] = useState<string>("");
  const [selectedFramework, setSelectedFramework] = useState("mixed");
  const [selectedAngle, setSelectedAngle] = useState("trust");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["FACEBOOK", "INSTAGRAM"]);
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  useEffect(() => {
    fetchPillars();
  }, []);

  const fetchPillars = async () => {
    try {
      const response = await fetch("/api/admin/organic/pillars");
      const data = await response.json();
      if (data.success) {
        setPillars(data.pillars);
        if (data.pillars.length > 0) {
          setSelectedPillar(data.pillars[0].name);
        }
      }
    } catch (error) {
      console.error("Error fetching pillars:", error);
    }
  };

  const handleGenerateContent = async () => {
    if (!selectedPillar) {
      alert("Please select a content pillar first");
      return;
    }

    setGenerating(true);
    setGeneratedOptions([]);

    try {
      const response = await fetch("/api/admin/organic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          pillar: selectedPillar,
          framework: selectedFramework,
          emotionalAngle: selectedAngle,
          platforms: selectedPlatforms.map(p => p.toLowerCase()),
          includeCallToAction: true,
        }),
      });

      const data = await response.json();
      if (data.success && data.posts) {
        setGeneratedOptions(data.posts);
      } else {
        alert("Failed to generate content");
      }
    } catch (error) {
      console.error("Error generating content:", error);
      alert("Failed to generate content");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectOption = (index: number) => {
    const post = generatedOptions[index];
    setSelectedOption(index);
    setContent(post.content);
    setHeadline(post.headline);
    setHook(post.hook);
    setHookType(post.hookType);
    setHashtags(post.hashtags);
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

  const handleRemoveHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag));
  };

  const togglePlatform = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleSaveAsDraft = async () => {
    await savePost("DRAFT");
  };

  const handleSchedule = async () => {
    if (!scheduledFor) {
      alert("Please select a date and time to schedule");
      return;
    }
    await savePost("SCHEDULED");
  };

  const handlePublishNow = async () => {
    if (!confirm("Publish this post immediately to the selected platforms?")) return;
    await savePost("APPROVED", true);
  };

  const savePost = async (status: string, publishImmediately = false) => {
    setLoading(true);

    try {
      // Find pillar ID
      const pillar = pillars.find(p => p.name === selectedPillar);

      const response = await fetch("/api/admin/organic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          headline,
          hook,
          hookType,
          hashtags,
          pillarId: pillar?.id,
          platforms: selectedPlatforms,
          imageUrl: imageUrl || null,
          scheduledFor: scheduledFor || null,
          aiGenerated: selectedOption !== null,
          aiFramework: selectedOption !== null ? generatedOptions[selectedOption].framework : null,
          emotionalAngle: selectedAngle,
          status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (publishImmediately) {
          // Publish immediately
          const publishResponse = await fetch(`/api/admin/organic/${data.post.id}/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platforms: selectedPlatforms.map(p => p.toLowerCase()) }),
          });

          const publishData = await publishResponse.json();
          if (publishData.success) {
            alert("Post published successfully!");
          } else {
            alert(`Post saved but publishing failed: ${publishData.error}`);
          }
        } else {
          alert(status === "SCHEDULED" ? "Post scheduled successfully!" : "Post saved as draft!");
        }
        router.push("/admin/organic");
      } else {
        alert(`Failed to save post: ${data.error}`);
      }
    } catch (error) {
      console.error("Error saving post:", error);
      alert("Failed to save post");
    } finally {
      setLoading(false);
    }
  };

  const selectedPillarData = pillars.find(p => p.name === selectedPillar);

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/organic">
            <button type="button" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create Post</h1>
            <p className="text-slate-600">Compose a new organic social media post</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - AI Generation & Options */}
          <div className="lg:col-span-1 space-y-6">
            {/* AI Generation Panel */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-5 border border-purple-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="font-semibold text-slate-900">AI Generator</h2>
              </div>

              {/* Pillar Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Content Pillar</label>
                <select
                  value={selectedPillar}
                  onChange={(e) => setSelectedPillar(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {pillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.name}>
                      {pillar.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Framework Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Copywriting Framework</label>
                <select
                  value={selectedFramework}
                  onChange={(e) => setSelectedFramework(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="mixed">Mixed (Best of All)</option>
                  <option value="justin-welsh">Justin Welsh - Hooks & Interrupts</option>
                  <option value="russell-brunson">Russell Brunson - Storytelling</option>
                  <option value="nicholas-cole">Nicholas Cole - Specificity</option>
                  <option value="simon-sinek">Simon Sinek - Purpose-Driven</option>
                </select>
              </div>

              {/* Emotional Angle */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Emotional Angle</label>
                <select
                  value={selectedAngle}
                  onChange={(e) => setSelectedAngle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="trust">Trust - Build credibility</option>
                  <option value="urgency">Urgency - Act now</option>
                  <option value="control">Control - Empower customer</option>
                  <option value="benefit">Benefit - Highlight value</option>
                  <option value="fear">Fear - Risk awareness</option>
                  <option value="curiosity">Curiosity - Spark interest</option>
                </select>
              </div>

              <Button
                onClick={handleGenerateContent}
                disabled={generating}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate 3 Options
                  </>
                )}
              </Button>
            </div>

            {/* Generated Options */}
            {generatedOptions.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Generated Options</h3>
                {generatedOptions.map((option, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectOption(index)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selectedOption === index
                        ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                        {option.framework}
                      </span>
                      {selectedOption === index && (
                        <CheckCircle className="w-4 h-4 text-purple-600" />
                      )}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-3">
                      {option.hook || option.content.slice(0, 100)}...
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {option.emotionalAngle} angle
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Middle & Right Column - Composer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Platform Selection */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Target Platforms</h3>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => togglePlatform("FACEBOOK")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    selectedPlatforms.includes("FACEBOOK")
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  <Facebook className="w-4 h-4" />
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={() => togglePlatform("INSTAGRAM")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    selectedPlatforms.includes("INSTAGRAM")
                      ? "border-pink-500 bg-pink-50 text-pink-700"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  <Instagram className="w-4 h-4" />
                  Instagram
                </button>
              </div>
            </div>

            {/* Content Editor */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">Post Content</h3>

              {/* Hook */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Hook (Opening Line)
                </label>
                <input
                  type="text"
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  placeholder="Stop the scroll with a powerful opening..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Main Content */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Main Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your post content here..."
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {content.length} characters
                </p>
              </div>

              {/* Headline (for image) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Headline (for image overlay)
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Bold headline for image..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Image URL */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  Image URL
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Required for Instagram posts
                </p>
              </div>

              {/* Hashtags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Hash className="w-4 h-4 inline mr-1" />
                  Hashtags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHashtag())}
                    placeholder="Add hashtag..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <Button onClick={handleAddHashtag} variant="outline">
                    Add
                  </Button>
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
                        onClick={() => handleRemoveHashtag(tag)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedPillarData?.hashtags.map((tag) => (
                    !hashtags.includes(tag) && (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setHashtags([...hashtags, tag])}
                        className="px-2 py-1 bg-slate-50 text-slate-500 text-sm rounded border border-dashed border-slate-300 hover:bg-slate-100"
                      >
                        + {tag}
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div className="bg-white rounded-xl p-5 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-4">
                <Calendar className="w-4 h-4 inline mr-2" />
                Schedule
              </h3>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <p className="text-xs text-slate-500 mt-2">
                Leave empty to publish immediately or save as draft
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 justify-end">
              <Button
                onClick={handleSaveAsDraft}
                disabled={loading || !content}
                variant="outline"
                className="border-slate-300"
              >
                <Save className="w-4 h-4 mr-2" />
                Save as Draft
              </Button>

              {scheduledFor && (
                <Button
                  onClick={handleSchedule}
                  disabled={loading || !content}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule
                </Button>
              )}

              <Button
                onClick={handlePublishNow}
                disabled={loading || !content || selectedPlatforms.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Publish Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
