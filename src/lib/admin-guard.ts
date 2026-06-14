import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

/** Returns the admin payload, or null if the request isn't an authenticated admin. */
export async function getAdmin() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}
