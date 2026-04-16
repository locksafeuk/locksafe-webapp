import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { blacklistToken, verifyTokenSync } from "@/lib/auth";

export async function POST() {
  try {
    // Get the current token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    // If token exists and is valid, add it to the blacklist
    if (token) {
      const payload = verifyTokenSync(token);
      if (payload) {
        // Add token to blacklist to invalidate it
        await blacklistToken(token, payload);
      }
    }

    // Clear the auth cookie
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully"
    });

    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    // Even if blacklisting fails, still clear the cookie
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully"
    });

    response.cookies.set("auth_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  }
}
