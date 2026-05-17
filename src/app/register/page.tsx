import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Create Your Account | LockSafe",
  description:
    "Join LockSafe and get trusted emergency locksmith help 24/7 across the UK. Create a free account in under 60 seconds.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-slate-50 flex flex-col">
      {/* Header */}
      <header className="py-6">
        <div className="section-container">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6 text-white"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-slate-900">
              Lock<span className="text-orange-500">Safe</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-8 px-4">
        <div className="w-full max-w-md">
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            }
          >
            <RegisterForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
