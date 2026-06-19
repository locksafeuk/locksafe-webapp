import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import crypto from "crypto";

const JWT_EXPIRES_IN = "7d";
const JWT_ALGORITHM = "HS256" as const;

// Read the signing secret at call time (never at import) so a missing secret
// fails loudly on the first auth operation instead of silently falling back to a
// public, committed default. No fallback: an unset JWT_SECRET must be a hard error.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. Refusing to sign/verify tokens with an insecure default.",
    );
  }
  return secret;
}

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
  return bcrypt.hashSync(password, 12);
}

// Verify password (bcrypt only — the legacy base64 "hashed:" format was a
// trivially-reversible backdoor and is no longer accepted; no live accounts use it).
export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

// Generate JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  });
}

// Hash token for storage (to prevent token leakage if DB is compromised)
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Check if token is blacklisted
// Bounded with a short timeout so a slow/unreachable DB cannot hang every admin API request.
async function isTokenBlacklisted(token: string): Promise<boolean> {
  const TIMEOUT_MS = 2000;
  try {
    const tokenHash = hashToken(token);
    const lookup = prisma.tokenBlacklist.findUnique({ where: { token: tokenHash } });
    const timeout = new Promise<"__timeout__">((resolve) =>
      setTimeout(() => resolve("__timeout__"), TIMEOUT_MS),
    );
    const result = await Promise.race([lookup, timeout]);
    if (result === "__timeout__") {
      console.error("isTokenBlacklisted: DB lookup timed out after", TIMEOUT_MS, "ms");
      // Fail secure on timeout to avoid honoring potentially revoked tokens.
      return true;
    }
    return !!result;
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

    // Then verify JWT signature and expiry (algorithm pinned to prevent confusion)
    return jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
  } catch {
    return null;
  }
}

// Synchronous token verification (without blacklist check) - use for initial parsing only
export function verifyTokenSync(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: [JWT_ALGORITHM] }) as TokenPayload;
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

// Locksmith auth that accepts BOTH the mobile Bearer token (Authorization
// header) and the web httpOnly cookie. Use for endpoints the mobile app writes
// to (availability, profile, price list) — the native app sends a Bearer token
// because it cannot read the httpOnly cookie.
export async function getLocksmithFromRequest(
  request: Request,
): Promise<LocksmithTokenPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const payload = await verifyToken(authHeader.slice(7));
    if (payload && payload.type === "locksmith") {
      return payload as LocksmithTokenPayload;
    }
  }
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
