import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

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

// Verify JWT token
export function verifyToken(token: string): TokenPayload | null {
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
