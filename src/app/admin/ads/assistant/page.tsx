"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Sparkles,
  RefreshCw,
  User,
  Bot,
  TrendingUp,
  Lightbulb,
  PenTool,
  Users,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  {
    icon: TrendingUp,
    label: "Why is my ROAS dropping?",
    prompt: "Analyze my campaign performance and tell me why my ROAS might be dropping. What should I change?",
  },
  {
    icon: PenTool,
    label: "Generate new ad copy",
    prompt: "Generate 4 new ad copy variations for my locksmith service. Focus on emergency situations and fast response times.",
  },
  {
    icon: Users,
    label: "Suggest better targeting",
    prompt: "Based on my current campaigns, suggest better audience targeting options that might improve conversions.",
  },
  {
    icon: DollarSign,
    label: "Optimize my budget",
    prompt: "Analyze my campaign spend and suggest how I should reallocate my budget for better results.",
  },
  {
    icon: AlertTriangle,
    label: "Check for ad fatigue",
    prompt: "Are any of my ads showing signs of fatigue? What metrics indicate this and what should I do?",
  },
  {
    icon: Lightbulb,
    label: "Campaign ideas",
    prompt: "Give me 3 new campaign ideas for a locksmith business targeting UK homeowners. Include objectives and messaging angles.",
  },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hello! I'm your AI Ad Assistant. I can help you with:

- **Analyzing performance** - Understanding why campaigns succeed or struggle
- **Generating copy** - Creating compelling ad variations
- **Audience suggestions** - Finding better targeting options
- **Budget optimization** - Making the most of your ad spend
- **Troubleshooting** - Identifying and fixing issues

How can I help you today?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [includeData, setIncludeData] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          includePerformanceData: includeData,
        }),
      });

      const data = await res.json();

      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            timestamp: new Date(),
          },
        ]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const formatMessage = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-200 px-1 rounded text-orange-600 text-sm">$1</code>')
      .replace(/\n/g, '<br />');
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8 h-[calc(100vh-4rem)] lg:h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/ads"
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Ad Assistant
              </h1>
              <p className="text-slate-500 text-sm">
                Ask anything about your ad campaigns
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeData}
              onChange={(e) => setIncludeData(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-slate-600 hidden sm:inline">Include campaign data</span>
            <span className="text-slate-600 sm:hidden">Data</span>
          </label>
        </div>

        {/* Chat Container */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Messages */}
          <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden">
            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-purple-600" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-orange-500 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <div
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: formatMessage(message.content),
                      }}
                    />
                    <div
                      className={`text-xs mt-2 ${
                        message.role === "user" ? "text-orange-200" : "text-slate-400"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-orange-600" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="bg-slate-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-slate-50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything about your ads..."
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Prompts Sidebar */}
          <div className="w-72 hidden lg:flex flex-col space-y-4">
            <div className="text-sm font-semibold text-slate-700">Quick Prompts</div>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {QUICK_PROMPTS.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => sendMessage(prompt.prompt)}
                    disabled={loading}
                    className="w-full flex items-start gap-3 p-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl text-left transition-all disabled:opacity-50"
                  >
                    <div className="p-1.5 bg-slate-100 rounded-lg">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="text-sm text-slate-700">{prompt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tips */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-purple-700 mb-2">
                Tips for better results
              </div>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>Be specific about what you want</li>
                <li>Mention your goals and constraints</li>
                <li>Ask follow-up questions</li>
                <li>Enable &quot;Include campaign data&quot; for personalized advice</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
