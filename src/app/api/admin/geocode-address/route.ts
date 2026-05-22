import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

async function geocodeViaPostcodesIo(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const compact = query.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 5) return null;

  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`);
    const data = await res.json();
    if (res.ok && data?.status === 200 && data?.result?.latitude && data?.result?.longitude) {
      return {
        lat: data.result.latitude,
        lng: data.result.longitude,
        label: data.result.postcode || query,
      };
    }
  } catch {
    // fall through to nominatim
  }

  return null;
}

async function geocodeViaNominatim(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${query}, UK`)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "LockSafeAdmin/1.0",
      },
    });
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first?.lat || !first?.lon) return null;

    return {
      lat: Number(first.lat),
      lng: Number(first.lon),
      label: first.display_name || query,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const query = String(body?.query || "").trim();

  if (!query) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  const postcodeMatch = query.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  const postcodeFirst = postcodeMatch ? await geocodeViaPostcodesIo(postcodeMatch[0]) : await geocodeViaPostcodesIo(query);
  if (postcodeFirst) {
    return NextResponse.json({ success: true, ...postcodeFirst });
  }

  const fallback = await geocodeViaNominatim(query);
  if (!fallback) {
    return NextResponse.json({ error: "Could not geocode address" }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...fallback });
}
