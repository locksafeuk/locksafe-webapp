import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning";
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
      duration = 5000,
    }: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).substring(7);
      const newToast: Toast = { id, title, description, variant, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toast,
    toasts,
    dismiss,
  };
}
