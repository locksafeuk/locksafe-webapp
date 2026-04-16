"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Briefcase,
  CreditCard,
  BarChart3,
  LogOut,
  PoundSterling,
  Megaphone,
  Menu,
  X,
  RotateCcw,
  TrendingUp,
  Sparkles,
  Share2,
  Mail,
  Bot,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AdminSidebarProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/voice-receptionist", label: "Voice AI", icon: Phone },
  { href: "/admin/agents", label: "AI Agents", icon: Bot },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { href: "/admin/locksmiths", label: "Locksmiths", icon: Users },
  { href: "/admin/customers", label: "Customers", icon: UserCircle },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/payouts", label: "Payouts", icon: PoundSterling },
  { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/attribution", label: "Attribution & ROAS", icon: TrendingUp },
  { href: "/admin/ads", label: "AI Ad Manager", icon: Sparkles },
  { href: "/admin/organic", label: "Organic Posts", icon: Share2 },
  { href: "/admin/emails", label: "Email Campaigns", icon: Mail },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
];

export function AdminSidebar({ children }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/auth");
        const data = await response.json();
        if (data.success && data.authenticated) {
          setAdmin(data.admin);
        } else {
          router.replace("/admin/login");
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.replace("/admin/login");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      router.replace("/admin/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Mobile Header */}
      <header className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <span className="font-bold">LockSafe Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 bg-slate-900 z-40 flex flex-col">
          {/* Scrollable Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? "bg-orange-500 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Fixed User Info & Logout at Bottom */}
          <div className="flex-shrink-0 p-4 border-t border-slate-700 bg-slate-900">
            <div className="text-sm text-slate-400 mb-1">Signed in as</div>
            <div className="font-medium text-white mb-4 truncate">{admin.email}</div>
            <Button
              onClick={handleLogout}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white border-0"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white hidden lg:flex flex-col z-40">
        {/* Logo - Fixed at top */}
        <div className="flex-shrink-0 flex items-center gap-3 p-6 border-b border-slate-800">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <div className="font-bold">LockSafe</div>
            <div className="text-xs text-slate-400">Admin Portal</div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive(item.href)
                  ? "bg-orange-500 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User Info & Logout - Fixed at bottom */}
        <div className="flex-shrink-0 border-t border-slate-700 p-4 bg-slate-900">
          <div className="mb-4">
            <div className="text-sm text-slate-400">Signed in as</div>
            <div className="font-medium truncate">{admin.email}</div>
          </div>
          <Button
            onClick={handleLogout}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white border-0"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
