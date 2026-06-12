"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getClientAttribution } from "@/lib/marketing/client-attribution";
import { refreshUserSession } from "@/hooks/useUserTracking";

interface User {
  id: string;
  email: string;
  name: string;
  type: "admin" | "locksmith" | "customer";
  role?: string;
  companyName?: string | null;
  phone?: string;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirectTo?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; redirectTo?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setOnboardingCompleted: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  referralCode?: string;
  pendingRequest?: {
    problemType: string;
    propertyType: string;
    postcode: string;
    address: string;
    description?: string;
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session");
      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to refresh session:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    try {
      // Phase A, 2026-06-12: include the visitor's attribution payload so
      // the server can stamp Customer.lastTouch* on login.
      const attribution = getClientAttribution();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...attribution }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        // Refresh the marketing session row so its customerId gets bound
        // (Phase B server work links UserSession → Customer for joins).
        refreshUserSession().catch(() => {});
        return { success: true, redirectTo: data.redirectTo };
      }

      return { success: false, error: data.error || "Login failed" };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "An error occurred during login" };
    }
  };

  const register = async (registerData: RegisterData) => {
    try {
      // Phase A, 2026-06-12: include the visitor's attribution payload so
      // Customer.firstTouch* + Customer.lastTouch* + the pendingRequest
      // Job get stamped from the originating UserSession.
      const attribution = getClientAttribution();
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...registerData, ...attribution }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        refreshUserSession().catch(() => {});
        return { success: true, redirectTo: data.redirectTo };
      }

      return { success: false, error: data.error || "Registration failed" };
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: "An error occurred during registration" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const setOnboardingCompleted = () => {
    if (user) {
      setUser({ ...user, onboardingCompleted: true });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshSession,
        setOnboardingCompleted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
