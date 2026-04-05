"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  CheckCircle,
  Facebook,
  Instagram,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";

interface SocialPost {
  id: string;
  content: string;
  headline: string | null;
  hook: string | null;
  platforms: string[];
  status: string;
  scheduledFor: string;
  pillar: {
    name: string;
    displayName: string;
    color: string;
  } | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function ContentCalendarPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("week");

  useEffect(() => {
    fetchPosts();
  }, [currentDate]);

  const fetchPosts = async () => {
    try {
      // Fetch posts with scheduling
      const response = await fetch("/api/admin/organic?status=SCHEDULED&limit=100");
      const data = await response.json();

      if (data.success) {
        setPosts(data.posts.filter((p: SocialPost) => p.scheduledFor));
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calendar helpers
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: Array<{ date: Date; posts: SocialPost[] }> = [];

    // Previous month days
    for (let i = startingDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, posts: getPostsForDate(date) });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ date, posts: getPostsForDate(date) });
    }

    // Next month days to fill the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, posts: getPostsForDate(date) });
    }

    return days;
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days: Array<{ date: Date; posts: SocialPost[] }> = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push({ date, posts: getPostsForDate(date) });
    }

    return days;
  };

  const getPostsForDate = (date: Date) => {
    return posts.filter((post) => {
      if (!post.scheduledFor) return false;
      const postDate = new Date(post.scheduledFor);
      return (
        postDate.getFullYear() === date.getFullYear() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getDate() === date.getDate()
      );
    });
  };

  const navigatePrevious = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const days = view === "month" ? getMonthDays() : getWeekDays();

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin/organic">
              <button type="button" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Content Calendar</h1>
              <p className="text-slate-600">Plan and schedule your organic content</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/admin/organic/create">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Post
              </Button>
            </Link>
          </div>
        </div>

        {/* Calendar Controls */}
        <div className="bg-white rounded-xl p-4 mb-6 border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={navigatePrevious}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>

              <h2 className="text-lg font-semibold text-slate-900 min-w-[180px] text-center">
                {view === "month"
                  ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : `Week of ${currentDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                }
              </h2>

              <button
                type="button"
                onClick={navigateNext}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>

              <Button onClick={goToToday} variant="outline" size="sm" className="ml-2">
                Today
              </Button>
            </div>

            <div className="flex bg-slate-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setView("week")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === "week" ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setView("month")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === "month" ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Days Header */}
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="px-2 py-3 text-center text-sm font-semibold text-slate-700"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Body */}
            <div className={`grid grid-cols-7 ${view === "month" ? "auto-rows-[120px]" : "auto-rows-[200px]"}`}>
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`border-b border-r border-slate-100 p-2 ${
                    !isCurrentMonth(day.date) && view === "month" ? "bg-slate-50" : ""
                  } ${isToday(day.date) ? "bg-orange-50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isToday(day.date)
                          ? "w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center"
                          : isCurrentMonth(day.date) || view === "week"
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      {day.date.getDate()}
                    </span>
                    {day.posts.length > 0 && view === "month" && (
                      <span className="text-xs text-slate-500">{day.posts.length}</span>
                    )}
                  </div>

                  <div className={`space-y-1 ${view === "month" ? "overflow-hidden" : "overflow-y-auto"} max-h-[calc(100%-24px)]`}>
                    {day.posts.slice(0, view === "month" ? 2 : 10).map((post) => (
                      <Link
                        key={post.id}
                        href={`/admin/organic/${post.id}`}
                        className={`block px-2 py-1 rounded text-xs truncate hover:opacity-80 transition-opacity ${
                          view === "week" ? "mb-2" : ""
                        }`}
                        style={{
                          backgroundColor: post.pillar ? `${post.pillar.color}20` : "#f1f5f9",
                          color: post.pillar?.color || "#475569",
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span className="font-medium">{formatTime(post.scheduledFor)}</span>
                        </div>
                        {view === "week" && (
                          <>
                            <p className="mt-1 line-clamp-2">
                              {post.hook || post.content.slice(0, 50)}
                            </p>
                            <div className="flex gap-1 mt-1">
                              {post.platforms.includes("FACEBOOK") && (
                                <Facebook className="w-3 h-3 text-blue-600" />
                              )}
                              {post.platforms.includes("INSTAGRAM") && (
                                <Instagram className="w-3 h-3 text-pink-600" />
                              )}
                            </div>
                          </>
                        )}
                      </Link>
                    ))}
                    {day.posts.length > (view === "month" ? 2 : 10) && (
                      <p className="text-xs text-slate-500 px-2">
                        +{day.posts.length - (view === "month" ? 2 : 10)} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium text-slate-700">Pillars:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "Anti-Fraud", color: "#EF4444" },
              { name: "Tips", color: "#3B82F6" },
              { name: "Stories", color: "#10B981" },
              { name: "Behind Scenes", color: "#8B5CF6" },
              { name: "Stats", color: "#F59E0B" },
              { name: "Engagement", color: "#EC4899" },
            ].map((pillar) => (
              <span
                key={pillar.name}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${pillar.color}20`,
                  color: pillar.color,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: pillar.color }}
                />
                {pillar.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AdminSidebar>
  );
}
