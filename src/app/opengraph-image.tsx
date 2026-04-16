import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "LockSafe UK - The Only Locksmith Platform That Prevents Price Scams";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          padding: "50px 60px",
          position: "relative",
        }}
      >
        {/* Decorative corner accents */}
        <div
          style={{
            position: "absolute",
            top: "0",
            right: "0",
            width: "300px",
            height: "300px",
            background: "radial-gradient(circle at top right, rgba(249, 115, 22, 0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            width: "250px",
            height: "250px",
            background: "radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.1) 0%, transparent 70%)",
          }}
        />

        {/* Top Bar: Logo + Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                background: "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "14px",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
              >
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
            </div>
            <span
              style={{
                fontSize: "36px",
                fontWeight: "bold",
                color: "white",
              }}
            >
              Lock
              <span style={{ color: "#f97316" }}>Safe</span>
              <span style={{ color: "#64748b", fontSize: "24px", marginLeft: "8px" }}>UK</span>
            </span>
          </div>

          {/* Category Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(249, 115, 22, 0.15)",
              border: "1px solid rgba(249, 115, 22, 0.3)",
              borderRadius: "30px",
              padding: "10px 20px",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              style={{ marginRight: "8px" }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span style={{ color: "#f97316", fontSize: "16px", fontWeight: "600" }}>
              UK's First Anti-Fraud Platform
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          {/* Problem Hook */}
          <div
            style={{
              fontSize: "20px",
              color: "#ef4444",
              fontWeight: "600",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ marginRight: "8px" }}>⚠️</span>
            Tired of £50 quotes becoming £300?
          </div>

          {/* Main Headline */}
          <div
            style={{
              fontSize: "54px",
              fontWeight: "800",
              color: "white",
              lineHeight: 1.15,
              marginBottom: "20px",
            }}
          >
            The Only Platform That
            <br />
            <span style={{ color: "#f97316" }}>Prevents Locksmith Scams</span>
          </div>

          {/* Value Prop */}
          <div
            style={{
              fontSize: "24px",
              color: "#94a3b8",
              lineHeight: 1.5,
              maxWidth: "800px",
            }}
          >
            Every job creates a legally-binding digital paper trail.
            <br />
            GPS tracking • Timestamped photos • Digital signatures • Instant PDF reports
          </div>
        </div>

        {/* Bottom Stats Bar */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            paddingTop: "30px",
            borderTop: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                background: "rgba(34, 197, 94, 0.15)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "white" }}>Verified</span>
              <span style={{ fontSize: "14px", color: "#64748b" }}>DBS Checked</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                background: "rgba(249, 115, 22, 0.15)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "white" }}>15-30 min</span>
              <span style={{ fontSize: "14px", color: "#64748b" }}>Response</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                background: "rgba(251, 191, 36, 0.15)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "white" }}>4.9/5</span>
              <span style={{ fontSize: "14px", color: "#64748b" }}>1,250+ Reviews</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                background: "rgba(59, 130, 246, 0.15)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "12px",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "white" }}>UK-Wide</span>
              <span style={{ fontSize: "14px", color: "#64748b" }}>24/7 Coverage</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
