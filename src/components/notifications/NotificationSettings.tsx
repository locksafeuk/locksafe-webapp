"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Check, AlertCircle, Smartphone, Mail, MessageSquare } from "lucide-react";
import { useOneSignal } from "@/hooks/useOneSignal";

interface NotificationSettingsProps {
  userId: string;
  userType: "customer" | "locksmith";
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  onEmailChange?: (enabled: boolean) => void;
  onSmsChange?: (enabled: boolean) => void;
}

export function NotificationSettings({
  userId,
  userType,
  emailNotifications = true,
  smsNotifications = true,
  onEmailChange,
  onSmsChange,
}: NotificationSettingsProps) {
  const {
    isSupported,
    isInitialized,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    playerId,
  } = useOneSignal({
    userId,
    userType,
  });

  const [localEmailEnabled, setLocalEmailEnabled] = useState(emailNotifications);
  const [localSmsEnabled, setLocalSmsEnabled] = useState(smsNotifications);
  const [testSent, setTestSent] = useState(false);

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleEmailToggle = () => {
    const newValue = !localEmailEnabled;
    setLocalEmailEnabled(newValue);
    onEmailChange?.(newValue);
  };

  const handleSmsToggle = () => {
    const newValue = !localSmsEnabled;
    setLocalSmsEnabled(newValue);
    onSmsChange?.(newValue);
  };

  const handleTestNotification = async () => {
    if (!isSubscribed || !playerId) return;

    try {
      // Send a test notification via OneSignal API
      const response = await fetch("/api/onesignal/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: [playerId],
          title: "Test Notification",
          message: "Push notifications are working correctly!",
        }),
      });

      if (response.ok) {
        setTestSent(true);
        setTimeout(() => setTestSent(false), 3000);
      }
    } catch (err) {
      console.error("Failed to send test notification:", err);
    }
  };

  const notificationTypes = [
    {
      id: "push",
      icon: Smartphone,
      title: "Push Notifications",
      description: isInitialized
        ? "Instant alerts on your device"
        : "Loading...",
      enabled: isSubscribed,
      onToggle: handlePushToggle,
      loading: isLoading || !isInitialized,
      supported: isSupported && permission !== "denied",
      blocked: permission === "denied",
    },
    {
      id: "email",
      icon: Mail,
      title: "Email Notifications",
      description: "Updates sent to your email",
      enabled: localEmailEnabled,
      onToggle: handleEmailToggle,
      loading: false,
      supported: true,
      blocked: false,
    },
    {
      id: "sms",
      icon: MessageSquare,
      title: "SMS Notifications",
      description: "Text messages for urgent alerts",
      enabled: localSmsEnabled,
      onToggle: handleSmsToggle,
      loading: false,
      supported: true,
      blocked: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
          <Bell className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Notification Preferences</h2>
          <p className="text-sm text-slate-600">
            Choose how you want to receive updates
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {notificationTypes.map((type) => (
          <div
            key={type.id}
            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
              type.enabled
                ? "bg-orange-50 border-orange-200"
                : "bg-slate-50 border-slate-200"
            } ${type.blocked ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  type.enabled
                    ? "bg-orange-100 text-orange-600"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                <type.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-900">{type.title}</h3>
                <p className="text-sm text-slate-600">{type.description}</p>
                {type.blocked && (
                  <p className="text-xs text-red-600 mt-1">
                    Blocked in browser settings
                  </p>
                )}
              </div>
            </div>

            {type.supported && !type.blocked ? (
              <button
                onClick={type.onToggle}
                disabled={type.loading}
                className={`relative w-12 h-7 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                  type.loading ? "opacity-50 cursor-wait" : "cursor-pointer"
                } ${type.enabled ? "bg-orange-500" : "bg-slate-300"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    type.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            ) : (
              <BellOff className="w-5 h-5 text-slate-400" />
            )}
          </div>
        ))}
      </div>

      {/* Test Notification Button */}
      {isSubscribed && playerId && (
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleTestNotification}
            disabled={testSent}
            className="w-full sm:w-auto"
          >
            {testSent ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-600" />
                Test Sent!
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                Send Test Notification
              </>
            )}
          </Button>
        </div>
      )}

      {/* Notification Types Info */}
      <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900 mb-2">
          When will I receive notifications?
        </p>
        {userType === "customer" ? (
          <ul className="space-y-1 list-disc list-inside">
            <li>When a locksmith applies to your job</li>
            <li>When your locksmith is on the way</li>
            <li>When your locksmith arrives</li>
            <li>When you receive a quote</li>
            <li>When the job is complete</li>
          </ul>
        ) : (
          <ul className="space-y-1 list-disc list-inside">
            <li>When a new job is available in your area</li>
            <li>When you're selected by a customer</li>
            <li>When a customer accepts your quote</li>
            <li>When you receive a payment</li>
            <li>When a payout is processed</li>
          </ul>
        )}
      </div>
    </div>
  );
}

export default NotificationSettings;
