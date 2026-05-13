"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, Building2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanyInfo {
  id: string;
  name: string;
  contactEmail: string;
  owner?: { name: string; email: string } | null;
}

interface CompanySidebarProps {
  children: React.ReactNode;
  companyId?: string; // passed when admin is impersonating
}

const navItems = [
  { href: "/company/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/company/team", label: "My Team", icon: Users },
  { href: "/company/settings", label: "Settings", icon: Settings },
];

export function CompanySidebar({ children, companyId }: CompanySidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // companyId may come from props or from URL search params (admin impersonation)
  const effectiveCompanyId = companyId ?? searchParams.get("companyId") ?? undefined;

  useEffect(() => {
    const check = async () => {
      try {
        const url = effectiveCompanyId
          ? `/api/company/auth?companyId=${effectiveCompanyId}`
          : "/api/company/auth";
        const res = await fetch(url);
        const data = await res.json();

        if (!data.authenticated) {
          router.replace("/company/login");
          return;
        }

        setCompany(data.company);
        setIsAdmin(data.isAdminImpersonating ?? false);
      } catch {
        router.replace("/company/login");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [router, effectiveCompanyId]);

  const handleLogout = async () => {
    if (isAdmin) {
      router.replace(`/admin/locksmith-teams`);
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/company/login");
  };

  const buildHref = (base: string) => {
    if (effectiveCompanyId) return `${base}?companyId=${effectiveCompanyId}`;
    return base;
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin impersonation banner */}
      {isAdmin && (
        <div className="bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-between z-50 relative">
          <span>👁 Admin view — viewing <strong>{company.name}</strong> manager portal</span>
          <Link href="/admin/locksmith-teams" className="flex items-center gap-1 underline hover:no-underline">
            <ChevronLeft className="w-4 h-4" /> Back to Admin
          </Link>
        </div>
      )}

      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-orange-500" />
          <span className="font-bold text-gray-900 truncate max-w-[200px]">{company.name}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 bg-white z-40 flex flex-col">
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={buildHref(item.href)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? "bg-orange-500 text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="text-sm text-gray-500 mb-1">Company</div>
            <div className="font-medium text-gray-900 mb-3 truncate">{company.name}</div>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              {isAdmin ? "Back to Admin" : "Sign Out"}
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 hidden lg:flex flex-col z-40">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-gray-900 truncate text-sm">{company.name}</div>
            <div className="text-xs text-gray-400">Manager Portal</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={buildHref(item.href)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                isActive(item.href)
                  ? "bg-orange-500 text-white font-medium"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-shrink-0 border-t border-gray-100 p-4">
          <div className="text-xs text-gray-400 mb-0.5">Signed in as</div>
          <div className="text-sm font-medium text-gray-800 truncate mb-3">{company.contactEmail}</div>
          <Button onClick={handleLogout} variant="outline" className="w-full h-9 text-sm">
            <LogOut className="w-3.5 h-3.5 mr-2" />
            {isAdmin ? "Back to Admin" : "Sign Out"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
