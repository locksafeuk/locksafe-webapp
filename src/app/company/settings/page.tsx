"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Building2,
  Mail,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { CompanySidebar } from "@/components/layout/CompanySidebar";

interface Company {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  vatNumber?: string | null;
  stripeConnectOnboarded: boolean;
  owner: { id: string; name: string; email: string } | null;
}

function CompanySettingsContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId") ?? undefined;
  const { toasts, toast, dismiss } = useToast();

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = companyId ? `/api/company/dashboard?companyId=${companyId}` : "/api/company/dashboard";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCompany(data.company);
      }
    } catch {
      toast({ title: "Failed to load settings", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <CompanySidebar companyId={companyId}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </CompanySidebar>
    );
  }

  if (!company) {
    return (
      <CompanySidebar companyId={companyId}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Could not load company settings.</p>
          </div>
        </div>
      </CompanySidebar>
    );
  }

  return (
    <CompanySidebar companyId={companyId}>
      <Toaster toasts={toasts} dismiss={dismiss} />
      <div className="p-6 max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-gray-600" />
            Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">Company profile and account settings</p>
        </div>

        {/* Company Profile */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500" />
              Company Profile
            </h2>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Company Name</div>
                <div className="text-sm font-medium text-gray-900">{company.name}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Contact Email</div>
                <div className="text-sm font-medium text-gray-900">{company.contactEmail}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Contact Phone</div>
                <div className="text-sm font-medium text-gray-900">{company.contactPhone}</div>
              </div>
            </div>
            {company.vatNumber && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400 text-xs font-bold mt-0.5 w-4 text-center flex-shrink-0">%</span>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">VAT Number</div>
                  <div className="text-sm font-medium text-gray-900">{company.vatNumber}</div>
                </div>
              </div>
            )}
            {company.owner && (
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Account Owner</div>
                  <div className="text-sm font-medium text-gray-900">{company.owner.name}</div>
                  <div className="text-xs text-gray-500">{company.owner.email}</div>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">To update company details, contact <a href="mailto:support@locksafe.uk" className="text-orange-600 hover:underline">support@locksafe.uk</a>.</p>
          </div>
        </div>

        {/* Stripe Payouts */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Stripe Payouts</h2>
          </div>
          <div className="px-6 py-5">
            {company.stripeConnectOnboarded ? (
              <div className="flex items-center gap-3 text-green-700">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">Stripe account connected</div>
                  <div className="text-xs text-gray-500 mt-0.5">Payouts are set up and active.</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-amber-700">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Stripe payouts not set up</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      You need to connect a Stripe account to receive commission payouts.
                    </div>
                  </div>
                </div>
                <a
                  href="mailto:support@locksafe.uk?subject=Stripe%20payout%20setup%20for%20company%20account"
                  className="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Contact support to set up payouts
                </a>
              </div>
            )}
          </div>
        </div>

      </div>
    </CompanySidebar>
  );
}

export default function CompanySettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}>
      <CompanySettingsContent />
    </Suspense>
  );
}
