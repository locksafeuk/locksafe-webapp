"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { Loader2 } from "lucide-react";

export default function LocksmithPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push("/locksmith/login");
      return;
    }

    // Redirect based on user type
    if (user?.type === "locksmith") {
      router.push("/locksmith/dashboard");
    } else if (user?.type === "admin") {
      router.push("/admin");
    } else if (user?.type === "customer") {
      router.push("/customer/dashboard");
    } else {
      router.push("/locksmith/login");
    }
  }, [isAuthenticated, isLoading, user, router]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-slate-600">Redirecting to locksmith portal...</p>
      </div>
    </div>
  );
}
