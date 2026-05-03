/**
 * Dynamic OG / catalog image for /services/[slug].
 *
 * Used by:
 *   - Open Graph / Twitter cards for the landing page
 *   - Meta Commerce Catalog `image_link` (see services-catalog.ts)
 *
 * 1:1 aspect ratio is preferred by Meta for dynamic product ads.
 */

import { getAllServiceSlugs, getServiceBySlug } from "@/lib/services-catalog";
import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 1080, height: 1080 };

export const alt = "LockSafe UK locksmith service";

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export default async function Image({
  params,
}: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);
  const title = service?.title ?? "LockSafe UK";
  const subhead = service?.subhead ?? "See the price before any work starts.";
  const priceBadge = service ? `From £${service.priceRangeLow}` : null;

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        padding: "80px",
        color: "white",
      }}
    >
      {/* Top badge */}
      <div
        style={{
          display: "flex",
          background: "#f97316",
          borderRadius: "999px",
          padding: "14px 32px",
          alignSelf: "flex-start",
          fontSize: "28px",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        LOCKSAFE.UK
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          fontSize: "92px",
          fontWeight: 800,
          lineHeight: 1.05,
          marginTop: "auto",
          marginBottom: "32px",
        }}
      >
        {title}
      </div>

      {/* Subhead */}
      <div
        style={{
          display: "flex",
          fontSize: "40px",
          lineHeight: 1.25,
          color: "#cbd5e1",
          marginBottom: "56px",
        }}
      >
        {subhead}
      </div>

      {/* Trust row */}
      <div
        style={{
          display: "flex",
          gap: "28px",
          fontSize: "26px",
          color: "#fef3c7",
          fontWeight: 600,
        }}
      >
        <div style={{ display: "flex" }}>✓ Verified locksmiths</div>
        <div style={{ display: "flex" }}>✓ Quote before work</div>
        <div style={{ display: "flex" }}>✓ No hidden fees</div>
      </div>

      {/* Price badge — bottom-right corner */}
      {priceBadge && (
        <div
          style={{
            position: "absolute",
            top: "80px",
            right: "80px",
            display: "flex",
            background: "white",
            color: "#0f172a",
            borderRadius: "20px",
            padding: "20px 32px",
            fontSize: "36px",
            fontWeight: 800,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {priceBadge}
        </div>
      )}
    </div>,
    { ...size },
  );
}
