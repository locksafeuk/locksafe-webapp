import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Free Home Security Checklist - LockSafe UK";
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
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          padding: "60px",
        }}
      >
        {/* Badge */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: "50px",
            padding: "12px 32px",
            marginBottom: "30px",
          }}
        >
          <span style={{ fontSize: "20px", color: "white", fontWeight: "600" }}>
            FREE SECURITY ASSESSMENT
          </span>
        </div>

        {/* Main Headline */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
            marginBottom: "16px",
            lineHeight: 1.2,
          }}
        >
          Is Your Home Secure?
        </div>

        <div
          style={{
            fontSize: "32px",
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            marginBottom: "50px",
          }}
        >
          Take our 5-minute checklist and find out
        </div>

        {/* Checklist Preview */}
        <div
          style={{
            display: "flex",
            gap: "20px",
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: "20px", color: "white" }}>Doors & Entry Points</span>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: "20px", color: "white" }}>Locks & Security</span>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: "20px", color: "white" }}>Risk Assessment</span>
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
              stroke="#059669"
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
