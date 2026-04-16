"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Check, CheckCheck, Clock, FileText, AlertTriangle, CreditCard, Loader2, UserCheck, MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
  jobId?: string;
  data?: Record<string, unknown>;
}

// Get icon based on notification type
function getNotificationIcon(type: string) {
  switch (type) {
    case "signature_reminder":
      return <FileText className="w-4 h-4 text-orange-500" />;
    case "auto_completed":
      return <CheckCheck className="w-4 h-4 text-green-500" />;
    case "payment":
      return <CreditCard className="w-4 h-4 text-blue-500" />;
    case "job_update":
      return <Bell className="w-4 h-4 text-purple-500" />;
    case "warning":
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case "locksmith_applied":
      return <UserCheck className="w-4 h-4 text-green-500" />;
    case "locksmith_arrived":
      return <MapPin className="w-4 h-4 text-blue-500" />;
    case "quote_received":
      return <FileText className="w-4 h-4 text-cyan-500" />;
    case "work_completed":
      return <CheckCheck className="w-4 h-4 text-green-500" />;
    case "review":
      return <Star className="w-4 h-4 text-yellow-500" />;
    default:
      return <Bell className="w-4 h-4 text-slate-500" />;
  }
}

// Format relative time
function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface NotificationBellProps {
  className?: string;
  variant?: "light" | "dark";
}

export function NotificationBell({ className = "", variant = "dark" }: NotificationBellProps) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (user.type === "customer") {
        params.set("customerId", user.id);
      } else if (user.type === "locksmith") {
        params.set("locksmithId", user.id);
      }
      params.set("limit", "20");

      const response = await fetch(`/api/notifications?${params}`);
      const data = await response.json();

      if (data.success) {
        setNotifications(data.notifications || []);
      } else {
        console.error("Failed to fetch notifications:", data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  // Fetch on mount and periodically
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
    }

    // Poll every 30 seconds
    const interval = setInterval(() => {
      if (isAuthenticated && user) {
        fetchNotifications();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isAuthenticated, user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    setMarkingRead(notificationId);
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
        )
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    } finally {
      setMarkingRead(null);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const params = new URLSearchParams();
      if (user.type === "customer") {
        params.set("customerId", user.id);
      } else if (user.type === "locksmith") {
        params.set("locksmithId", user.id);
      }

      await fetch(`/api/notifications/read-all?${params}`, {
        method: "PATCH",
      });

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  if (!isAuthenticated) return null;

  // Button styles based on variant
  const buttonStyles = variant === "light"
    ? "p-2 hover:bg-slate-100 rounded-lg transition-colors relative text-slate-600 hover:text-slate-900"
    : "p-2 hover:bg-slate-800 rounded-lg transition-colors relative text-white";

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={buttonStyles}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : error ? (
              <div className="py-8 text-center">
                <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">{error}</p>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div key={notification.id} className="relative">
                    {notification.actionUrl ? (
                      <Link
                        href={notification.actionUrl}
                        onClick={() => handleNotificationClick(notification)}
                        className={`block px-4 py-3 hover:bg-slate-50 transition-colors ${
                          !notification.read ? "bg-orange-50/50" : ""
                        }`}
                      >
                        <NotificationContent notification={notification} />
                      </Link>
                    ) : (
                      <div
                        className={`px-4 py-3 ${!notification.read ? "bg-orange-50/50" : ""}`}
                        onClick={() => !notification.read && markAsRead(notification.id)}
                      >
                        <NotificationContent notification={notification} />
                      </div>
                    )}

                    {/* Mark as read button */}
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                        disabled={markingRead === notification.id}
                        className="absolute right-3 top-3 p-1 hover:bg-slate-200 rounded-full transition-colors"
                        title="Mark as read"
                      >
                        {markingRead === notification.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                        ) : (
                          <Check className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-center">
              <Link
                href={user?.type === "locksmith" ? "/locksmith/notifications" : "/customer/notifications"}
                onClick={() => setIsOpen(false)}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Notification content component
function NotificationContent({ notification }: { notification: Notification }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <p className={`text-sm ${!notification.read ? "font-semibold" : "font-medium"} text-slate-900 line-clamp-1`}>
          {notification.title}
        </p>
        <p className="text-sm text-slate-600 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400">
            {formatRelativeTime(notification.createdAt)}
          </span>
          {notification.actionLabel && (
            <span className="text-xs text-orange-600 font-medium">
              {notification.actionLabel} →
            </span>
          )}
        </div>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2" />
      )}
    </div>
  );
}
