import { NextRequest, NextResponse } from "next/server";

/**
 * Google Places (New) Autocomplete proxy for free-text UK address entry.
 * Server-side only — the API key never reaches the browser.
 *
 * Query params:
 *   - input    (required, ≥3 chars): what the user is typing in the address field
 *   - postcode (optional): used to bias results to the user's postcode area so
 *                          the suggestions are real premises within their PAF range
 *
 * Response: { suggestions: Array<{ text, mainText, secondaryText }> }
 */

export const runtime = "nodejs";

interface GoogleSuggestion {
  placePrediction?: {
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
    types?: string[];
  };
}

interface GoogleAutocompleteResponse {
  suggestions?: GoogleSuggestion[];
  error?: { message?: string; status?: string };
}

interface SuggestionDTO {
  text: string;
  mainText: string;
  secondaryText: string;
}

export async function GET(req: NextRequest) {
  const input = (req.nextUrl.searchParams.get("input") ?? "").trim();
  const postcode = (req.nextUrl.searchParams.get("postcode") ?? "").trim().toUpperCase();

  if (input.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Address autocomplete is not configured" },
      { status: 503 }
    );
  }

  // To get premise-level UK results, biasing by text alone isn't enough —
  // Google needs a geographic hint. Look up the postcode's lat/lng on
  // postcodes.io (free, no key) and apply a tight locationBias circle so
  // suggestions stay near the user's postcode.
  let bias: { circle: { center: { latitude: number; longitude: number }; radius: number } } | null =
    null;
  if (postcode) {
    try {
      const pc = postcode.replace(/\s/g, "");
      const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
      if (pcRes.ok) {
        const pcData = (await pcRes.json()) as {
          result?: { latitude?: number; longitude?: number };
        };
        const lat = pcData.result?.latitude;
        const lng = pcData.result?.longitude;
        if (typeof lat === "number" && typeof lng === "number") {
          bias = { circle: { center: { latitude: lat, longitude: lng }, radius: 1500 } };
        }
      }
    } catch {
      // ignore — fall back to text-only bias
    }
  }

  try {
    const body: Record<string, unknown> = {
      input,
      includedRegionCodes: ["GB"],
      languageCode: "en-GB",
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
    };
    if (bias) body.locationBias = bias;

    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[address/autocomplete] google error", res.status, body.slice(0, 300));
      return NextResponse.json(
        { suggestions: [], error: "upstream", status: res.status },
        { status: 502 }
      );
    }

    const data = (await res.json()) as GoogleAutocompleteResponse;
    const suggestions: SuggestionDTO[] = (data.suggestions ?? [])
      .map((s) => {
        const text = s.placePrediction?.text?.text?.trim() ?? "";
        const mainText = s.placePrediction?.structuredFormat?.mainText?.text?.trim() ?? "";
        const secondaryText =
          s.placePrediction?.structuredFormat?.secondaryText?.text?.trim() ?? "";
        return { text, mainText, secondaryText };
      })
      .filter((s) => s.text.length > 0);

    return NextResponse.json(
      { suggestions },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err) {
    console.error("[address/autocomplete] fetch failed", err);
    return NextResponse.json({ suggestions: [], error: "fetch_failed" }, { status: 502 });
  }
}
