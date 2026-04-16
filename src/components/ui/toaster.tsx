"use client";

import { X, CheckCircle, AlertCircle, Info, XCircle } from "lucide-react";
import { Toast } from "@/hooks/use-toast";

interface ToasterProps {
  toasts: Toast[];
  dismiss: (id: string) => void;
}

const variantStyles = {
  default: "bg-slate-900 text-white border-slate-800",
  success: "bg-green-50 text-green-900 border-green-200",
  error: "bg-red-50 text-red-900 border-red-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
};

const variantIcons = {
  default: Info,
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
};

export function Toaster({ toasts, dismiss }: ToasterProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const Icon = variantIcons[toast.variant || "default"];
        const styles = variantStyles[toast.variant || "default"];

        return (
          <div
            key={toast.id}
            className={`${styles} pointer-events-auto rounded-lg border shadow-lg p-4 animate-in slide-in-from-top-5 duration-300`}
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {toast.title && (
                  <div className="font-semibold text-sm mb-0.5">{toast.title}</div>
                )}
                {toast.description && (
                  <div className="text-sm opacity-90">{toast.description}</div>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
