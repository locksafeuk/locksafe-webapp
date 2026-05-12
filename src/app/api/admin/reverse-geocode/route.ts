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

interface GeoItem {
  id: string;
  lat: number;
  lng: number;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const items: GeoItem[] = body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ postcodes: {} });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Google API key not configured" }, { status: 500 });
  }

  const postcodes: Record<string, string> = {};

  await Promise.all(
    items.map(async ({ id, lat, lng }) => {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=postal_code&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        const postcode = data.results?.[0]?.address_components?.find(
          (c: { types: string[] }) => c.types.includes("postal_code")
        )?.long_name;
        if (postcode) postcodes[id] = postcode;
      } catch {
        // silently skip failures for individual items
      }
    })
  );

  return NextResponse.json({ postcodes });
}
