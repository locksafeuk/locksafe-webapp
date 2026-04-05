import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Request Emergency Locksmith - LockSafe UK";
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
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
          padding: "60px",
        }}
      >
        {/* Urgent Badge */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: "50px",
            padding: "12px 32px",
            marginBottom: "30px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "24px", color: "white", fontWeight: "600" }}>
            EMERGENCY HELP AVAILABLE 24/7
          </span>
        </div>

        {/* Main Headline */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            marginBottom: "24px",
            lineHeight: 1.1,
          }}
        >
          Locked Out?
        </div>

        <div
          style={{
            fontSize: "40px",
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            marginBottom: "40px",
          }}
        >
          Get Help in Minutes
        </div>

        {/* Features Row */}
        <div
          style={{
            display: "flex",
            gap: "40px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: "12px",
              padding: "16px 24px",
            }}
          >
            <span style={{ fontSize: "24px", color: "white" }}>15-30 min response</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: "12px",
              padding: "16px 24px",
            }}
          >
            <span style={{ fontSize: "24px", color: "white" }}>Verified Locksmiths</span>
          </div>
        </div>

        {/* Logo */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "50px",
              height: "50px",
              background: "white",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "12px",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="2"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <span style={{ fontSize: "28px", fontWeight: "bold", color: "white" }}>
            LockSafe UK
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
