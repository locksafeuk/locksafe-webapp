"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, PlayCircle } from "lucide-react";

const TEST_SCENARIOS = [
  {
    id: "a2z",
    group: "payments",
    title: "A2Z Real Scenario",
    description:
      "Books a real test job, applies locksmith, pays assessment, quotes, signs completion, and validates final payment.",
    command: "npm run test:a2z:hosted",
    accentClass: "bg-emerald-600 hover:bg-emerald-700",
    iconClass: "text-emerald-600",
  },
  {
    id: "stripe",
    group: "payments",
    title: "Stripe Sandbox Suite",
    description:
      "Runs Stripe-focused hosted checks: key mode, fee maths, decline-card, setup-intent, and webhook validation.",
    command: "npm run test:stripe-sandbox:hosted",
    accentClass: "bg-blue-600 hover:bg-blue-700",
    iconClass: "text-blue-600",
  },
  {
    id: "system",
    group: "platform",
    title: "System Test (Hosted)",
    description:
      "Runs the end-to-end system checks on locksafe.uk with admin and cron paths skipped.",
    command: "npm run test:system:prod",
    accentClass: "bg-indigo-600 hover:bg-indigo-700",
    iconClass: "text-indigo-600",
  },
  {
    id: "reliability",
    group: "platform",
    title: "Reliability Daily Check",
    description:
      "Runs daily reliability diagnostics against production and reports critical path health.",
    command: "npm run reliability:daily:prod",
    accentClass: "bg-amber-600 hover:bg-amber-700",
    iconClass: "text-amber-600",
  },
  {
    id: "llm",
    group: "ai",
    title: "LLM Failover Health",
    description:
      "Validates Ollama-first routing and fallback controls to catch model/runtime drift early.",
    command: "npm run health:llm-failover",
    accentClass: "bg-violet-600 hover:bg-violet-700",
    iconClass: "text-violet-600",
  },
  {
    id: "agents",
    group: "ai",
    title: "Agents Runtime Verify",
    description:
      "Checks orchestrator/runtime wiring for agents and flags policy/runtime mismatches.",
    command: "npm run verify:agents-runtime",
    accentClass: "bg-slate-700 hover:bg-slate-800",
    iconClass: "text-slate-700",
  },
] as const;

type ScenarioId = (typeof TEST_SCENARIOS)[number]["id"];

const SCENARIO_GROUPS = [
  {
    id: "payments",
    title: "Payments",
    description: "Checkout and Stripe flow validations.",
  },
  {
    id: "platform",
    title: "Platform Health",
    description: "Core system and reliability diagnostics.",
  },
  {
    id: "ai",
    title: "AI and Agents",
    description: "Model routing and orchestration runtime checks.",
  },
] as const;

export default function AdminTestingPage() {
  const [copied, setCopied] = useState<ScenarioId | null>(null);

  const copyCommand = async (command: string, key: ScenarioId) => {
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

        <div className="space-y-8">
          {SCENARIO_GROUPS.map((group) => {
            const scenarios = TEST_SCENARIOS.filter((scenario) => scenario.group === group.id);

            return (
              <section key={group.id}>
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-slate-900">{group.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{group.description}</p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{scenario.title}</h3>
                          <p className="text-sm text-slate-500 mt-1">{scenario.description}</p>
                        </div>
                        <PlayCircle className={`w-6 h-6 ${scenario.iconClass}`} />
                      </div>

                      <div className="bg-slate-900 text-slate-100 rounded-xl px-4 py-3 text-sm font-mono break-all">
                        {scenario.command}
                      </div>

                      <div className="mt-4 flex items-center gap-3">
                        <Button
                          onClick={() => copyCommand(scenario.command, scenario.id)}
                          className={scenario.accentClass}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Command
                        </Button>
                        {copied === scenario.id && (
                          <span className="text-sm text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Copied
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </AdminSidebar>
  );
}
