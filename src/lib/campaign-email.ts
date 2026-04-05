import { Resend } from "resend";
import { SITE_URL, SITE_NAME, SUPPORT_EMAIL } from "./config";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "LockSafe UK <noreply@locksafe.uk>";

// Email template types
export type EmailTemplate = "announcement" | "newsletter" | "update" | "promo" | "urgent" | "custom";

export interface CampaignEmailData {
  to: string;
  toName: string;
  subject: string;
  preheader?: string;
  template: EmailTemplate;
  headline?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  accentColor?: string;
  recipientId?: string; // For tracking
}

// Generate beautiful HTML email from template
export function generateCampaignEmail(data: CampaignEmailData): string {
  const accentColor = data.accentColor || "#f97316";
  const preheader = data.preheader || "";

  // Template-specific header styling
  const headerStyles: Record<EmailTemplate, { bg: string; icon: string }> = {
    announcement: {
      bg: `linear-gradient(135deg, ${accentColor}, ${adjustColor(accentColor, -20)})`,
      icon: "📢",
    },
    newsletter: {
      bg: `linear-gradient(135deg, #1e293b, #334155)`,
      icon: "📰",
    },
    update: {
      bg: `linear-gradient(135deg, #3b82f6, #2563eb)`,
      icon: "🔄",
    },
    promo: {
      bg: `linear-gradient(135deg, #16a34a, #15803d)`,
      icon: "🎉",
    },
    urgent: {
      bg: `linear-gradient(135deg, #dc2626, #b91c1c)`,
      icon: "⚠️",
    },
    custom: {
      bg: `linear-gradient(135deg, ${accentColor}, ${adjustColor(accentColor, -20)})`,
      icon: "✉️",
    },
  };

  const style = headerStyles[data.template] || headerStyles.custom;

  // Build tracking pixel URL if we have a recipient ID
  const trackingPixel = data.recipientId
    ? `<img src="${SITE_URL}/api/admin/emails/track?type=open&rid=${data.recipientId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`
    : "";

  // Wrap CTA URL with tracking if we have recipient ID
  const ctaUrl = data.ctaUrl && data.recipientId
    ? `${SITE_URL}/api/admin/emails/track?type=click&rid=${data.recipientId}&url=${encodeURIComponent(data.ctaUrl)}`
    : data.ctaUrl;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${data.subject}</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #1e293b;
          background-color: #f8fafc;
          -webkit-font-smoothing: antialiased;
        }

        .preheader {
          display: none !important;
          visibility: hidden;
          mso-hide: all;
          font-size: 1px;
          line-height: 1px;
          max-height: 0;
          max-width: 0;
          opacity: 0;
          overflow: hidden;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }

        .email-wrapper {
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
        }

        .header {
          background: ${style.bg};
          padding: 40px 32px;
          text-align: center;
          color: #ffffff;
        }

        .header-icon {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }

        .header h1 {
          font-size: 28px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .content {
          padding: 32px;
          background: #ffffff;
        }

        .greeting {
          font-size: 16px;
          color: #64748b;
          margin-bottom: 24px;
        }

        .body-content {
          font-size: 16px;
          color: #334155;
          line-height: 1.7;
        }

        .body-content p {
          margin-bottom: 16px;
        }

        .body-content ul, .body-content ol {
          margin: 16px 0;
          padding-left: 24px;
        }

        .body-content li {
          margin-bottom: 8px;
        }

        .cta-wrapper {
          text-align: center;
          margin: 32px 0;
        }

        .cta-button {
          display: inline-block;
          background: ${accentColor};
          color: #ffffff !important;
          padding: 16px 40px;
          font-size: 16px;
          font-weight: 600;
          text-decoration: none;
          border-radius: 10px;
          box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
        }

        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e2e8f0, transparent);
          margin: 24px 0;
        }

        .footer {
          background: #f8fafc;
          padding: 24px 32px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }

        .footer-logo {
          font-size: 20px;
          font-weight: 700;
          color: ${accentColor};
          margin-bottom: 12px;
        }

        .footer-text {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.6;
        }

        .footer-links {
          margin-top: 16px;
        }

        .footer-links a {
          color: #64748b;
          text-decoration: none;
          margin: 0 8px;
          font-size: 12px;
        }

        .footer-links a:hover {
          color: ${accentColor};
        }

        .social-links {
          margin-top: 16px;
        }

        .social-links a {
          display: inline-block;
          margin: 0 8px;
        }

        @media only screen and (max-width: 600px) {
          .container {
            padding: 12px;
          }

          .header {
            padding: 32px 24px;
          }

          .header h1 {
            font-size: 24px;
          }

          .content {
            padding: 24px;
          }

          .cta-button {
            padding: 14px 32px;
          }
        }
      </style>
    </head>
    <body>
      <div class="preheader">${preheader}</div>

      <div class="container">
        <div class="email-wrapper">
          <!-- Header -->
          <div class="header">
            <span class="header-icon">${style.icon}</span>
            ${data.headline ? `<h1>${data.headline}</h1>` : ""}
          </div>

          <!-- Content -->
          <div class="content">
            <p class="greeting">Hi ${data.toName},</p>

            <div class="body-content">
              ${data.body}
            </div>

            ${data.ctaText && ctaUrl ? `
            <div class="cta-wrapper">
              <a href="${ctaUrl}" class="cta-button" target="_blank">${data.ctaText}</a>
            </div>
            ` : ""}

            <div class="divider"></div>

            <p style="font-size: 14px; color: #64748b; text-align: center;">
              Questions? Reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: ${accentColor};">${SUPPORT_EMAIL}</a>
            </p>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-logo">${SITE_NAME}</div>
            <p class="footer-text">
              Emergency Locksmith Service<br>
              24/7 Available | Anti-Fraud Protected
            </p>
            <div class="footer-links">
              <a href="${SITE_URL}/locksmith/dashboard">Dashboard</a>
              <span style="color: #cbd5e1;">|</span>
              <a href="${SITE_URL}/locksmith/settings">Settings</a>
              <span style="color: #cbd5e1;">|</span>
              <a href="${SITE_URL}/help">Help</a>
            </div>
            <p class="footer-text" style="margin-top: 16px; font-size: 10px;">
              You're receiving this email because you're a registered locksmith on ${SITE_NAME}.<br>
              <a href="${SITE_URL}/locksmith/settings" style="color: #64748b;">Manage email preferences</a>
            </p>
          </div>
        </div>
      </div>

      ${trackingPixel}
    </body>
    </html>
  `;

  return html;
}

// Helper function to adjust color brightness
function adjustColor(hex: string, percent: number): string {
  const num = Number.parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;

  return `#${(
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`;
}

// Send campaign email
export async function sendCampaignEmail(
  data: CampaignEmailData
): Promise<{ success: boolean; resendId?: string; error?: unknown }> {
  try {
    // In development, just log the email
    if (!process.env.RESEND_API_KEY) {
      console.log("Campaign email would be sent:", data);
      return { success: true, resendId: `mock_${Date.now()}` };
    }

    const html = generateCampaignEmail(data);

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: data.subject,
      html,
      headers: {
        "X-Entity-Ref-ID": data.recipientId || "",
      },
    });

    return { success: true, resendId: result.data?.id };
  } catch (error) {
    console.error("Failed to send campaign email:", error);
    return { success: false, error };
  }
}

// Generate preview HTML (without tracking)
export function generatePreviewEmail(data: Omit<CampaignEmailData, "to" | "toName">): string {
  return generateCampaignEmail({
    ...data,
    to: "preview@example.com",
    toName: "Preview User",
    recipientId: undefined, // No tracking for preview
  });
}
