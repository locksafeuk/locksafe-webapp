"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  PoundSterling,
  LogOut,
  Menu,
  X,
  Bell,
  History,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AvailabilityToggle } from "@/components/locksmith/AvailabilityToggle";

const navItems = [
  { href: "/locksmith/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/locksmith/jobs", label: "Available Jobs", icon: Briefcase },
  { href: "/locksmith/history", label: "Job History", icon: History },
  { href: "/locksmith/earnings", label: "Earnings", icon: PoundSterling },
  { href: "/locksmith/settings", label: "Settings", icon: Settings },
];

export default function LocksmithLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Fetch profile image
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/locksmith/profile?locksmithId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.profile?.profileImage) {
            setProfileImage(data.profile.profileImage);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  // Swipe to close
  const touchStartX = useRef<number | null>(null);
  const touchCurrentX = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchCurrentX.current = e.touches[0].clientX;

    const diff = touchStartX.current - touchCurrentX.current;

    // Only allow swiping left (to close)
    if (diff > 0 && sidebarRef.current) {
      const translateX = Math.min(diff, 300);
      sidebarRef.current.style.transform = `translateX(-${translateX}px)`;
      sidebarRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchCurrentX.current === null) return;

    const diff = touchStartX.current - touchCurrentX.current;

    // If swiped more than 100px, close the sidebar
    if (diff > 100) {
      setSidebarOpen(false);
    }

    // Reset transform
    if (sidebarRef.current) {
      sidebarRef.current.style.transform = '';
      sidebarRef.current.style.transition = '';
    }

    touchStartX.current = null;
    touchCurrentX.current = null;
  };

  // Don't show layout for login page
  if (pathname === "/locksmith/login") {
    return <>{children}</>;
  }

  // Don't show layout for public locksmith profile pages
  if (pathname.match(/^\/locksmith\/[a-zA-Z0-9-]+$/) && !pathname.includes("/dashboard") && !pathname.includes("/jobs") && !pathname.includes("/earnings") && !pathname.includes("/job/") && !pathname.includes("/settings") && !pathname.includes("/history")) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/locksmith/dashboard") {
      return pathname === "/locksmith/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Mobile Header */}
      <header className="lg:hidden bg-slate-900 text-white sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <span className="font-bold">LockSafe</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Availability Status Indicator */}
            {user?.id && (
              <AvailabilityToggle
                locksmithId={user.id}
                variant="minimal"
              />
            )}
            <NotificationBell />
            {profileImage ? (
              <img
                src={profileImage}
                alt={user?.name || "Profile"}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm">
                {user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "LS"}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            ref={sidebarRef}
            className="fixed top-0 left-0 bottom-0 w-[280px] max-w-[85vw] bg-slate-900 text-white flex flex-col animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold">LockSafe</div>
                  <div className="text-xs text-slate-400">Locksmith Portal</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
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

              {/* Mobile Availability Toggle in Sidebar */}
              {user?.id && (
                <div className="mt-6 pt-4 border-t border-slate-700">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 px-4">Availability</div>
                  <div className="px-2">
                    <AvailabilityToggle
                      locksmithId={user.id}
                      variant="default"
                    />
                  </div>
                </div>
              )}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800">
              <div className="mb-4">
                <div className="text-sm text-slate-400">Signed in as</div>
                <div className="font-medium truncate">{user?.name || "Locksmith"}</div>
                <div className="text-xs text-slate-400 truncate">{user?.email}</div>
              </div>
              <Button
                onClick={handleLogout}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white p-6 hidden lg:block z-40">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <div className="font-bold">LockSafe</div>
            <div className="text-xs text-slate-400">Locksmith Portal</div>
          </div>
        </div>

        <nav className="space-y-1">
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

        {/* Desktop Availability Toggle */}
        {user?.id && (
          <div className="mt-6 px-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-2">Status</div>
            <AvailabilityToggle
              locksmithId={user.id}
              variant="compact"
            />
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6">
          <div className="border-t border-slate-700 pt-4 mb-4">
            <div className="text-sm text-slate-400">Signed in as</div>
            <div className="font-medium truncate">{user?.name || "Locksmith"}</div>
            <div className="text-xs text-slate-400 truncate">{user?.email}</div>
          </div>
          <Button
            onClick={handleLogout}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64">
        {children}
      </main>
    </div>
  );
}
