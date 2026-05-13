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
  Rocket,
  ShieldCheck,
  Map,
  Users2,
  Percent,
  Gift,
  AlertTriangle,
  Building2,
  MapPin,
  Shield,
  ChevronDown,
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

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
      { href: "/admin/ops", label: "Live Ops Map", icon: MapPin },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/admin/locksmiths", label: "Locksmiths", icon: Users },
      { href: "/admin/locksmith-teams", label: "Locksmith Teams", icon: Users2 },
      { href: "/admin/organisations", label: "Organisations", icon: Building2 },
      { href: "/admin/customers", label: "Customers", icon: UserCircle },
      { href: "/admin/leads", label: "Leads", icon: Users2 },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/payouts", label: "Payouts", icon: PoundSterling },
      { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
      { href: "/admin/commission-tiers", label: "Commission Tiers", icon: Percent },
      { href: "/admin/referrals", label: "Referrals", icon: Gift },
    ],
  },
  {
    label: "Trust & Safety",
    items: [
      { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
      { href: "/admin/security", label: "Security / Radar", icon: Shield },
    ],
  },
  {
    label: "AI & Automation",
    items: [
      { href: "/admin/voice-receptionist", label: "Voice AI", icon: Phone },
      { href: "/admin/agents", label: "AI Agents", icon: Bot },
      { href: "/admin/agents/approvals", label: "Approvals", icon: ShieldCheck },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/ads", label: "AI Ad Manager", icon: Sparkles },
      { href: "/admin/ads/launch", label: "Launch Engine", icon: Rocket },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/attribution", label: "Attribution & ROAS", icon: TrendingUp },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/marketing/meta-catalog", label: "Meta Catalog", icon: Megaphone },
      { href: "/admin/organic", label: "Organic Posts", icon: Share2 },
      { href: "/admin/emails", label: "Email Campaigns", icon: Mail },
      { href: "/admin/seo", label: "Intent SEO", icon: Map },
    ],
  },
];

export function AdminSidebar({ children }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const NavGroupSection = ({
    group,
    onLinkClick,
  }: {
    group: NavGroup;
    onLinkClick?: () => void;
  }) => {
    const isCollapsed = collapsed[group.label] ?? false;
    const hasActive = group.items.some((item) => isActive(item.href));
    return (
      <div className="mb-1">
        <button
          type="button"
          onClick={() => toggleGroup(group.label)}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md transition-colors ${
            hasActive ? "text-orange-400" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest">
            {group.label}
          </span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${
              isCollapsed ? "-rotate-90" : ""
            }`}
          />
        </button>
        {!isCollapsed && (
          <div className="space-y-0.5 mb-2">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                  isActive(item.href)
                    ? "bg-orange-500 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5 text-white"
              stroke="currentColor"
              strokeWidth="2"
            >
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
          <nav className="flex-1 overflow-y-auto p-4">
            {navGroups.map((group) => (
              <NavGroupSection
                key={group.label}
                group={group}
                onLinkClick={() => setMobileMenuOpen(false)}
              />
            ))}
          </nav>
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
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center gap-3 p-6 border-b border-slate-800">
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
          <div>
            <div className="font-bold">LockSafe</div>
            <div className="text-xs text-slate-400">Admin Portal</div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          {navGroups.map((group) => (
            <NavGroupSection key={group.label} group={group} />
          ))}
        </nav>

        {/* User info & logout */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold text-orange-400 shrink-0">
              {admin.name?.charAt(0).toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{admin.name}</div>
              <div className="text-xs text-slate-400 truncate">{admin.email}</div>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 border-0 gap-2 px-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
