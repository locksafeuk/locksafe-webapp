"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RequestCTAButton } from "@/components/onboarding/RequestCTAButton";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Phone, ArrowRight, LogIn, User, LogOut, ChevronDown, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";

const navItems = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Locksmiths", href: "/for-locksmiths" },
  { label: "Blog", href: "/blog" },
];

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by only rendering auth UI after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    router.push("/");
  };

  const getDashboardLink = () => {
    if (!user) return "/";
    switch (user.type) {
      case "admin":
        return "/admin";
      case "locksmith":
        return "/locksmith/dashboard";
      case "customer":
        return "/customer/dashboard";
      default:
        return "/";
    }
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="announcement-bar">
        <div className="section-container flex items-center justify-center gap-2 sm:gap-3">
          <span className="hidden sm:inline">24/7 Emergency Locksmith Service Across the UK</span>
          <span className="sm:hidden text-xs">24/7 Emergency Service UK</span>
          <span className="hidden sm:inline text-white/60">•</span>
          <a
            href="tel:07818333989"
            className="hidden sm:flex items-center gap-1 text-orange-300 hover:text-orange-200 transition-colors font-semibold"
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="text-sm">07818 333 989</span>
          </a>
          <span className="hidden sm:inline text-white/60">•</span>
          <Link href="/request" className="hidden sm:inline underline hover:text-orange-400 transition-colors">
            Get Help Now →
          </Link>
        </div>
      </div>

      {/* Main Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled ? "glass-effect shadow-sm" : "bg-white"
        }`}
      >
        <div className="section-container">
          <nav className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
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

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-4">
              <a
                href="tel:07818333989"
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
              >
                <Phone className="w-4 h-4" />
                07818 333 989
              </a>

              {/* Login/User Menu */}
              {isMounted && !isLoading && (
                <>
                  {isAuthenticated && user ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-orange-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 max-w-[100px] truncate">
                          {user.name.split(" ")[0]}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
                      </button>

                      {/* Dropdown Menu */}
                      {showUserMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowUserMenu(false)}
                          />
                          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                            <div className="px-4 py-2 border-b border-slate-100">
                              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                              <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full capitalize">
                                {user.type}
                              </span>
                            </div>
                            <Link
                              href={getDashboardLink()}
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <User className="w-4 h-4" />
                              Dashboard
                            </Link>
                            <button
                              type="button"
                              onClick={handleLogout}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                            >
                              <LogOut className="w-4 h-4" />
                              Sign Out
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <Link href="/login">
                      <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50">
                        <LogIn className="w-4 h-4" />
                        Login
                      </Button>
                    </Link>
                  )}
                </>
              )}

              <RequestCTAButton className="btn-primary">
                Get Emergency Help
                <ArrowRight className="w-4 h-4" />
              </RequestCTAButton>
            </div>

            {/* Mobile: Help Now Button + Menu */}
            <div className="flex lg:hidden items-center gap-2">
              {/* Persistent Help Now Button - Always visible on mobile */}
              <RequestCTAButton
                size="sm"
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-2 h-9 text-xs sm:text-sm animate-pulse-subtle"
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                Help Now
              </RequestCTAButton>

              {/* Mobile Menu */}
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="w-6 h-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-96 p-0">
                  <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Browse LockSafe pages, contact us, or access your account.
                  </SheetDescription>
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-4 border-b">
                      <Link href="/" className="flex items-center gap-2" onClick={() => setIsOpen(false)}>
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
                        <span className="text-xl font-bold text-slate-900">
                          Lock<span className="text-orange-500">Safe</span>
                        </span>
                      </Link>
                    </div>

                    <div className="flex-1 p-4 space-y-2">
                      {navItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className="block py-3 px-4 text-lg font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>

                    <div className="p-4 border-t space-y-3">
                      <a
                        href="tel:07818333989"
                        className="flex items-center justify-center gap-2 py-3 text-slate-700 font-medium"
                      >
                        <Phone className="w-5 h-5" />
                        07818 333 989
                      </a>

                      {/* Mobile Login/User Actions */}
                      {isMounted && !isLoading && (
                        <>
                          {isAuthenticated && user ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">{user.name}</p>
                                  <p className="text-xs text-slate-500 capitalize">{user.type} Account</p>
                                </div>
                              </div>
                              <Link href={getDashboardLink()} onClick={() => setIsOpen(false)}>
                                <Button variant="outline" className="w-full justify-center">
                                  <User className="w-4 h-4" />
                                  Go to Dashboard
                                </Button>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  handleLogout();
                                  setIsOpen(false);
                                }}
                                className="flex items-center justify-center gap-2 w-full py-2 text-red-600 hover:text-red-700 text-sm font-medium"
                              >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                              </button>
                            </div>
                          ) : (
                            <Link href="/login" onClick={() => setIsOpen(false)}>
                              <Button variant="outline" className="w-full justify-center border-slate-300">
                                <LogIn className="w-4 h-4" />
                                Login / Sign Up
                              </Button>
                            </Link>
                          )}
                        </>
                      )}

                      <RequestCTAButton
                        className="w-full btn-primary justify-center"
                        onNavigate={() => setIsOpen(false)}
                      >
                        Get Emergency Help
                        <ArrowRight className="w-4 h-4" />
                      </RequestCTAButton>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
