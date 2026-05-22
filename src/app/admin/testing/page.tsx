"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, PlayCircle } from "lucide-react";

const COMMAND_A2Z = "npm run test:a2z:hosted";
const COMMAND_STRIPE = "npm run test:stripe-sandbox:hosted";

export default function AdminTestingPage() {
  const [copied, setCopied] = useState<"a2z" | "stripe" | null>(null);

  const copyCommand = async (command: string, key: "a2z" | "stripe") => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch (error) {
      console.error("Failed to copy command", error);
    }
  };

  return (
    <AdminSidebar>
      <div className="p-4 lg:p-8">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Testing</h1>
          <p className="text-slate-500 mt-1">
            Quick runner commands for payment-system validation.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">A2Z Real Scenario</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Books a real test job, applies locksmith, pays assessment, quotes,
                  signs completion, and validates final payment.
                </p>
              </div>
              <PlayCircle className="w-6 h-6 text-emerald-600" />
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl px-4 py-3 text-sm font-mono break-all">
              {COMMAND_A2Z}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => copyCommand(COMMAND_A2Z, "a2z")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Command
              </Button>
              {copied === "a2z" && (
                <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Copied
                </span>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Stripe Sandbox Suite</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Runs Stripe-focused hosted checks: key mode, fee maths, decline-card,
                  setup-intent, and webhook validation.
                </p>
              </div>
              <PlayCircle className="w-6 h-6 text-blue-600" />
            </div>

            <div className="bg-slate-900 text-slate-100 rounded-xl px-4 py-3 text-sm font-mono break-all">
              {COMMAND_STRIPE}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => copyCommand(COMMAND_STRIPE, "stripe")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Command
              </Button>
              {copied === "stripe" && (
                <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Copied
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </AdminSidebar>
  );
}
