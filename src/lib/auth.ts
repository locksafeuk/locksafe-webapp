import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "locksafe-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AdminTokenPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  type: "admin";
}

export interface LocksmithTokenPayload {
  id: string;
  email: string;
  name: string;
  companyName: string | null;
  type: "locksmith";
}

export interface CustomerTokenPayload {
  id: string;
  email: string;
  name: string;
  phone: string;
  type: "customer";
}

export type TokenPayload = AdminTokenPayload | LocksmithTokenPayload | CustomerTokenPayload;

// Hash password
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

// Verify password
export function verifyPassword(password: string, hash: string): boolean {
  // Check if it's the old demo format first
  try {
    const decoded = Buffer.from(hash, "base64").toString();
    if (decoded === `hashed:${password}`) {
      return true;
    }
  } catch {
    // Not base64 encoded, try bcrypt
  }

  // Try bcrypt
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

// Generate JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Hash token for storage (to prevent token leakage if DB is compromised)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Check if token is blacklisted
async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);
    const blacklisted = await prisma.tokenBlacklist.findUnique({
      where: { token: tokenHash },
    });
    return !!blacklisted;
  } catch (error) {
    console.error("Error checking token blacklist:", error);
    // Fail secure - if we can't check, assume it's blacklisted
    return true;
  }
}

// Add token to blacklist
export async function blacklistToken(token: string, payload: TokenPayload): Promise<void> {
  try {
    const tokenHash = hashToken(token);
    // Calculate expiry from JWT exp claim or default to 7 days from now
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.tokenBlacklist.create({
      data: {
        token: tokenHash,
        userId: payload.id,
        userType: payload.type,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("Error blacklisting token:", error);
    // Don't throw - logout should still work even if blacklist fails
  }
}

// Clean up expired tokens from blacklist (call this periodically via cron)
export async function cleanupExpiredBlacklistedTokens(): Promise<void> {
  try {
    await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  } catch (error) {
    console.error("Error cleaning up blacklisted tokens:", error);
  }
}

// Verify JWT token (with blacklist check)
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    // First check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return null;
    }

    // Then verify JWT signature and expiry
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Synchronous token verification (without blacklist check) - use for initial parsing only
export function verifyTokenSync(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// Get token from cookies (server-side)
export async function getServerSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

// Check if admin is authenticated
export async function isAdminAuthenticated(): Promise<AdminTokenPayload | null> {
  const session = await getServerSession();

  if (session && session.type === "admin") {
    return session as AdminTokenPayload;
  }

  return null;
}

// Check if locksmith is authenticated
export async function isLocksmithAuthenticated(): Promise<LocksmithTokenPayload | null> {
  const session = await getServerSession();

  if (session && session.type === "locksmith") {
    return session as LocksmithTokenPayload;
  }

  return null;
}

// Check if customer is authenticated
export async function isCustomerAuthenticated(): Promise<CustomerTokenPayload | null> {
  const session = await getServerSession();

  if (session && session.type === "customer") {
    return session as CustomerTokenPayload;
  }

  return null;
}

// Get redirect path based on user type
export function getRedirectPath(userType: string): string {
  switch (userType) {
    case "admin":
      return "/admin";
    case "locksmith":
      return "/locksmith/dashboard";
    case "customer":
      return "/customer/dashboard";
    default:
      return "/";
  }
}

// Cookie options
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: "/",
};
