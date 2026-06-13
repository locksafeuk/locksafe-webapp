"use client";

import { useState, useEffect, useMemo } from "react";
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
  Plug,
  Globe,
  Search,
  Crown,
  Brain,
  Sprout,
  Gauge,
  MessageCircle,
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
  /** Tailwind text-color for header label, chevron, and active icon */
  color: string;
  /** Tailwind bg-color for the left-border strip on the header */
  border: string;
  /** Tailwind bg-color (subtle) for the active nav item pill */
  activeBg: string;
  /** Tailwind text-color for active nav item text */
  activeText: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    color: "text-amber-400",
    border: "bg-amber-400",
    activeBg: "bg-amber-500/20",
    activeText: "text-amber-300",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    color: "text-sky-400",
    border: "bg-sky-500",
    activeBg: "bg-sky-500/20",
    activeText: "text-sky-300",
    items: [
      { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
      { href: "/admin/ops", label: "Live Ops Map", icon: MapPin },
    ],
  },
  {
    label: "People",
    color: "text-emerald-400",
    border: "bg-emerald-500",
    activeBg: "bg-emerald-500/20",
    activeText: "text-emerald-300",
    items: [
      { href: "/admin/locksmiths", label: "Locksmiths", icon: Users },
      { href: "/admin/locksmith-teams", label: "Locksmith Teams", icon: Users2 },
      { href: "/admin/organisations", label: "Organisations", icon: Building2 },
      { href: "/admin/customers", label: "Customers", icon: UserCircle },
      { href: "/admin/leads", label: "Leads", icon: Users2 },
      { href: "/admin/whatsapp", label: "WhatsApp Inbox", icon: MessageCircle },
    ],
  },
  {
    label: "Finance",
    color: "text-green-400",
    border: "bg-green-500",
    activeBg: "bg-green-500/20",
    activeText: "text-green-300",
    items: [
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/payouts", label: "Payouts", icon: PoundSterling },
      { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
      { href: "/admin/testing", label: "Testing", icon: Rocket },
      { href: "/admin/commission-tiers", label: "Commission Tiers", icon: Percent },
      { href: "/admin/referrals", label: "Referrals", icon: Gift },
      { href: "/admin/subscriptions", label: "Cover Subscriptions", icon: Crown },
    ],
  },
  {
    label: "Trust & Safety",
    color: "text-red-400",
    border: "bg-red-500",
    activeBg: "bg-red-500/20",
    activeText: "text-red-300",
    items: [
      { href: "/admin/disputes", label: "Disputes", icon: AlertTriangle },
      { href: "/admin/security", label: "Security / Radar", icon: Shield },
    ],
  },
  {
    label: "AI & Automation",
    color: "text-violet-400",
    border: "bg-violet-500",
    activeBg: "bg-violet-500/20",
    activeText: "text-violet-300",
    items: [
      { href: "/admin/voice-receptionist", label: "Voice AI", icon: Phone },
      { href: "/admin/agents", label: "AI Agents", icon: Bot },
      { href: "/admin/agents/control-plane", label: "Control Plane", icon: Gauge },
      { href: "/admin/agents/approvals", label: "Approvals", icon: ShieldCheck },
    ],
  },
  {
    label: "Marketing",
    color: "text-pink-400",
    border: "bg-pink-500",
    activeBg: "bg-pink-500/20",
    activeText: "text-pink-300",
    items: [
      { href: "/admin/ads", label: "AI Ad Manager", icon: Sparkles },
      { href: "/admin/ads/launch", label: "Launch Engine", icon: Rocket },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/attribution", label: "Attribution & ROAS", icon: TrendingUp },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/marketing/meta-catalog", label: "Meta Catalog", icon: Megaphone },
      { href: "/admin/organic", label: "Organic Posts", icon: Share2 },
      { href: "/admin/social-connect", label: "Social Accounts", icon: Share2 },
      { href: "/admin/emails", label: "Email Campaigns", icon: Mail },
      { href: "/admin/seo", label: "Intent SEO", icon: Map },
      { href: "/admin/ai-visibility", label: "AI Visibility", icon: Sparkles },
    ],
  },
  {
    label: "System",
    color: "text-cyan-400",
    border: "bg-cyan-500",
    activeBg: "bg-cyan-500/20",
    activeText: "text-cyan-300",
    items: [
      { href: "/admin/integrations", label: "Integrations", icon: Plug },
      { href: "/admin/agents/reflections", label: "Agent Reflections", icon: Brain },
      { href: "/admin/integrations/google-ads/seed-bank", label: "Keyword Seed Bank", icon: Sprout },
    ],
  },
];

function NavGroupSection({
  group,
  isActive,
  collapsed,
  toggleGroup,
  onLinkClick,
  forceExpand,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
  collapsed: Record<string, boolean>;
  toggleGroup: (label: string, hasActive: boolean) => void;
  onLinkClick?: () => void;
  forceExpand?: boolean;
}) {
  const hasActive = group.items.some((item) => isActive(item.href));
  // Default state: every group is COLLAPSED, except the one containing the
  // currently-active page (so the user has context on first load). Once the
  // user explicitly toggles a group, that explicit choice wins.
  const explicit = collapsed[group.label];
  const isCollapsed = (explicit ?? !hasActive) && !forceExpand;

  return (
    <div className="mb-2">
      {/* Section header */}
      <button
        type="button"
        onClick={() => toggleGroup(group.label, hasActive)}
        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-1 h-4 rounded-full ${group.border} shrink-0`} />
          <span
            className={`text-[11px] font-bold uppercase tracking-widest ${group.color} ${
              hasActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
            } transition-opacity`}
          >
            {group.label}
          </span>
        </div>
        <span
          className={`flex items-center justify-center w-5 h-5 rounded-full ${
            hasActive ? `${group.activeBg}` : "bg-white/5 group-hover:bg-white/10"
          } transition-all`}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${group.color} ${
              isCollapsed ? "-rotate-90" : ""
            }`}
          />
        </span>
      </button>

      {!isCollapsed && (
        <div className="mt-0.5 space-y-0.5 mb-1 pl-1">
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onLinkClick}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                  active
                    ? `${group.activeBg} ${group.activeText} border border-white/10 shadow-sm`
                    : `text-slate-400 hover:${group.activeText} hover:bg-white/8`
                }`}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? group.color : `${group.color} opacity-50 group-hover:opacity-100`
                  }`}
                />
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className={`ml-auto w-1.5 h-1.5 rounded-full ${group.border} shrink-0`} />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavContent({
  search,
  setSearch,
  filteredGroups,
  isActive,
  collapsed,
  toggleGroup,
  onLinkClick,
}: {
  search: string;
  setSearch: (v: string) => void;
  filteredGroups: NavGroup[];
  isActive: (href: string) => boolean;
  collapsed: Record<string, boolean>;
  toggleGroup: (label: string, hasActive: boolean) => void;
  onLinkClick?: () => void;
}) {
  const isSearching = search.trim().length > 0;
  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search menu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-orange-400/60 focus:bg-white/8 transition-all"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear menu search"
            title="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isSearching && filteredGroups.length === 0 && (
        <p className="text-xs text-slate-500 px-3 py-4 text-center">No results for "{search}"</p>
      )}

      {filteredGroups.map((group) => (
        <NavGroupSection
          key={group.label}
          group={group}
          isActive={isActive}
          collapsed={collapsed}
          toggleGroup={toggleGroup}
          onLinkClick={onLinkClick}
          forceExpand={isSearching}
        />
      ))}
    </>
  );
}

export function AdminSidebar({ children }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/auth");
        // Only treat an explicit auth failure (401/403) as a redirect trigger.
        // Network errors / 5xx must NOT call router.replace() — doing so wipes
        // history entries and makes the browser Back button feel like it
        // "jumps to another menu item" because the previous URL is gone.
        if (response.status === 401 || response.status === 403) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) {
          console.warn(`Auth check returned ${response.status}; keeping current page.`);
          return;
        }
        const data = await response.json();
        if (data.success && data.authenticated) {
          setAdmin(data.admin);
        } else {
          router.replace("/admin/login");
        }
      } catch (error) {
        // Network failure — do NOT redirect; just log and stay put.
        console.error("Auth check network failure:", error);
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

  const toggleGroup = (label: string, hasActive: boolean) => {
    setCollapsed((prev) => {
      const current = prev[label] ?? !hasActive;
      return { ...prev, [label]: !current };
    });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Filter groups/items by search query; auto-clear collapse when searching
  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return navGroups;
    return navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            g.label.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [search]);

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
      <header className="lg:hidden bg-slate-950 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <span className="font-bold tracking-tight">LockSafe Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 bg-slate-950 z-40 flex flex-col">
          <nav className="flex-1 overflow-y-auto p-4">
            <NavContent
              search={search}
              setSearch={setSearch}
              filteredGroups={filteredGroups}
              isActive={isActive}
              collapsed={collapsed}
              toggleGroup={toggleGroup}
              onLinkClick={() => setMobileMenuOpen(false)}
            />
          </nav>
          <div className="flex-shrink-0 p-4 border-t border-white/10">
            <div className="text-xs text-slate-500 mb-1">Signed in as</div>
            <div className="text-sm font-medium text-white mb-3 truncate">{admin.email}</div>
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
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-950 text-white hidden lg:flex flex-col z-40 border-r border-white/5">
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-5 border-b border-white/8">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-white tracking-tight">LockSafe</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Admin Portal</div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          <NavContent
            search={search}
            setSearch={setSearch}
            filteredGroups={filteredGroups}
            isActive={isActive}
            collapsed={collapsed}
            toggleGroup={toggleGroup}
          />
        </nav>

        {/* User info & logout */}
        <div className="flex-shrink-0 px-4 py-4 border-t border-white/8 bg-slate-950">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow shadow-orange-500/20">
              {admin.name?.charAt(0).toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{admin.name}</div>
              <div className="text-[11px] text-slate-500 truncate">{admin.email}</div>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-slate-500 hover:text-white hover:bg-white/8 border-0 gap-2 px-2 text-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}


interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}


