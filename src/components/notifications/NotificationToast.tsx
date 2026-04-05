"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Bell, CheckCircle2, AlertCircle, Info, X } from "lucide-react";

interface Notification {
  id: string;
  type: "success" | "error" | "info" | "locksmith_applied";
  title: string;
  message: string;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, "id" | "timestamp">) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date(),
    };
    setNotifications((prev) => [newNotification, ...prev]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, removeNotification, clearAll }}
    >
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
}

function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
}

function NotificationToast({ notification, onClose }: NotificationToastProps) {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    locksmith_applied: <Bell className="w-5 h-5 text-orange-500" />,
  };

  const backgrounds = {
    success: "bg-green-50 border-green-200",
    error: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
    locksmith_applied: "bg-orange-50 border-orange-200",
  };

  return (
    <div
      className={`animate-in slide-in-from-right-full fade-in duration-300 ${backgrounds[notification.type]} border rounded-xl p-4 shadow-lg flex items-start gap-3`}
    >
      {icons[notification.type]}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 text-sm">{notification.title}</div>
        <div className="text-slate-600 text-sm">{notification.message}</div>
      </div>
      <button
        onClick={onClose}
        className="p-1 hover:bg-black/5 rounded-full transition-colors"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

// Standalone component for pages that don't use the provider
export function StandaloneNotificationToast({
  show,
  onClose,
  type = "info",
  title,
  message,
}: {
  show: boolean;
  onClose: () => void;
  type?: "success" | "error" | "info" | "locksmith_applied";
  title: string;
  message: string;
}) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    locksmith_applied: <Bell className="w-5 h-5 text-orange-500" />,
  };

  const backgrounds = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
    locksmith_applied: "bg-orange-600",
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className={`${backgrounds[type]} text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3`}>
        {icons[type]}
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-sm opacity-90">{message}</div>
        </div>
        <button onClick={onClose} className="ml-2 hover:bg-white/10 p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
