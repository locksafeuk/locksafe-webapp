import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Join as a Locksmith - LockSafe UK";
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          padding: "60px",
        }}
      >
        {/* Badge */}
        <div
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
            borderRadius: "50px",
            padding: "12px 32px",
            marginBottom: "30px",
          }}
        >
          <span style={{ fontSize: "20px", color: "white", fontWeight: "600" }}>
            JOIN THE UK'S FASTEST GROWING NETWORK
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
          Become a LockSafe Partner
        </div>

        <div
          style={{
            fontSize: "32px",
            color: "#94a3b8",
            textAlign: "center",
            marginBottom: "50px",
          }}
        >
          Set Your Own Rates • Work Your Schedule • Get Paid Fast
        </div>

        {/* Benefits Row */}
        <div
          style={{
            display: "flex",
            gap: "30px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(249, 115, 22, 0.1)",
              borderRadius: "16px",
              padding: "24px 32px",
              border: "1px solid rgba(249, 115, 22, 0.3)",
            }}
          >
            <span style={{ fontSize: "28px", fontWeight: "bold", color: "#f97316" }}>
              No Hidden Fees
            </span>
            <span style={{ fontSize: "16px", color: "#94a3b8", marginTop: "8px" }}>
              Keep 100% of assessment
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(249, 115, 22, 0.1)",
              borderRadius: "16px",
              padding: "24px 32px",
              border: "1px solid rgba(249, 115, 22, 0.3)",
            }}
          >
            <span style={{ fontSize: "28px", fontWeight: "bold", color: "#f97316" }}>
              Fast Payouts
            </span>
            <span style={{ fontSize: "16px", color: "#94a3b8", marginTop: "8px" }}>
              Direct to your bank
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(249, 115, 22, 0.1)",
              borderRadius: "16px",
              padding: "24px 32px",
              border: "1px solid rgba(249, 115, 22, 0.3)",
            }}
          >
            <span style={{ fontSize: "28px", fontWeight: "bold", color: "#f97316" }}>
              Quality Leads
            </span>
            <span style={{ fontSize: "16px", color: "#94a3b8", marginTop: "8px" }}>
              Pre-qualified customers
            </span>
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
              background: "linear-gradient(135deg, #f97316 0%, #f59e0b 100%)",
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
              stroke="white"
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
