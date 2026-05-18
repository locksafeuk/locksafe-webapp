import type { AdminTokenPayload } from "@/lib/auth";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function requireAdminFromCookies(): Promise<AdminTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export function unauthorizedAgentApiResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
