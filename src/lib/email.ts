import { Resend } from "resend";
import { SITE_URL, SITE_NAME, SUPPORT_EMAIL } from "./config";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "LockSafe UK <noreply@locksafe.uk>";

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(data: EmailData) {
  try {
    // In development, just log the email
    if (!process.env.RESEND_API_KEY) {
      console.log("Email would be sent:", data);
      return { success: true, mock: true };
    }

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.to,
      subject: data.subject,
      html: data.html,
    });

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ============================================
// AUTHENTICATION EMAILS
// ============================================

export async function sendVerificationEmail(
  customerEmail: string,
  data: {
    customerName: string;
    verificationUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f97316; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; text-align: center; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for creating an account with LockSafe UK. Please verify your email address to complete your registration.</p>

          <div class="box">
            <p style="margin:0 0 16px 0;color:#64748b;">Click the button below to verify your email:</p>
            <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
          </div>

          <p style="color:#64748b;font-size:14px;">This link will expire in 24 hours. If you didn't create an account with LockSafe, you can safely ignore this email.</p>

          <p style="color:#64748b;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${data.verificationUrl}" style="color:#f97316;word-break:break-all;">${data.verificationUrl}</a></p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Verify your email - LockSafe UK`,
    html,
  });
}

export async function sendPasswordResetEmail(
  customerEmail: string,
  data: {
    customerName: string;
    resetUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e293b; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; text-align: center; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>We received a request to reset your password for your LockSafe account. Click the button below to create a new password.</p>

          <div class="box">
            <p style="margin:0 0 16px 0;color:#64748b;">Click the button below to reset your password:</p>
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </div>

          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;">
            <strong>Security notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
          </p>

          <p style="color:#64748b;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${data.resetUrl}" style="color:#f97316;word-break:break-all;">${data.resetUrl}</a></p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Reset your password - LockSafe UK`,
    html,
  });
}

// ============================================
// JOB EMAILS
// ============================================

// Email templates
export async function sendJobConfirmationEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    assessmentFee: number;
    eta: number;
    address: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f97316; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">Booking Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Great news! Your locksmith is on the way.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">JOB NUMBER</p>
            <p style="margin:4px 0 0 0;font-size:18px;font-weight:bold;">${data.jobNumber}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">YOUR LOCKSMITH</p>
            <p style="margin:4px 0;font-size:18px;font-weight:bold;">${data.locksmithName}</p>
            <p style="margin:0;color:#f97316;font-weight:bold;">ETA: ${data.eta} minutes</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">LOCATION</p>
            <p style="margin:4px 0 0 0;">${data.address}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">ASSESSMENT FEE PAID</p>
            <p style="margin:4px 0 0 0;font-size:24px;font-weight:bold;color:#16a34a;">£${data.assessmentFee}</p>
          </div>

          <p>The locksmith will assess your lock and provide a quote for any work needed. You can accept or decline the quote with no obligation.</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/customer/job/${data.jobNumber}" class="button">Track Your Job</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Booking Confirmed - ${data.locksmithName} is on the way! (${data.jobNumber})`,
    html,
  });
}

export async function sendQuoteReceivedEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    quoteTotal: number;
    estimatedTime: number;
    diagnosis: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f97316; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 8px; }
        .button-outline { display: inline-block; background: white; color: #f97316; padding: 12px 24px; border-radius: 8px; text-decoration: none; border: 2px solid #f97316; margin: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">Quote Received</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>${data.locksmithName} has completed the assessment and sent you a quote for the work.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">DIAGNOSIS</p>
            <p style="margin:4px 0 0 0;">${data.diagnosis}</p>
          </div>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">QUOTE TOTAL</p>
            <p style="margin:4px 0 0 0;font-size:36px;font-weight:bold;color:#f97316;">£${data.quoteTotal}</p>
            <p style="margin:8px 0 0 0;color:#64748b;">Estimated time: ${data.estimatedTime} minutes</p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/customer/job/${data.jobNumber}/quote" class="button">View Full Quote</a>
          </p>

          <p style="background:#dbeafe;padding:12px;border-radius:8px;font-size:14px;color:#1e40af;">
            <strong>No obligation:</strong> If you decline, you've only paid the assessment fee. No additional charges.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Quote Received: £${data.quoteTotal} - Review and Respond (${data.jobNumber})`,
    html,
  });
}

export async function sendLocksmithApplicationNotification(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    assessmentFee: number;
    eta: number;
    rating: number;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">New Locksmith Available!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>A locksmith has applied for your job and is ready to help.</p>

          <div class="box">
            <p style="margin:0;font-size:20px;font-weight:bold;">${data.locksmithName}</p>
            <p style="margin:4px 0;">Rating: ${"★".repeat(Math.round(data.rating))} ${data.rating}/5</p>
            <p style="margin:4px 0;color:#f97316;font-weight:bold;">Assessment Fee: £${data.assessmentFee}</p>
            <p style="margin:4px 0;color:#64748b;">Can arrive in: ${data.eta} minutes</p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/customer/job/${data.jobNumber}" class="button">View All Applications</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `${data.locksmithName} can help! ETA: ${data.eta} min (${data.jobNumber})`,
    html,
  });
}

export async function sendJobCompletionEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    totalPaid: number;
    reportUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 20px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">Job Completed!</h1>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Your locksmith job has been completed successfully.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">TOTAL PAID</p>
            <p style="margin:4px 0 0 0;font-size:36px;font-weight:bold;color:#16a34a;">£${data.totalPaid}</p>
          </div>

          <p>Your legal PDF report is ready. This document contains:</p>
          <ul>
            <li>Complete job timeline with GPS verification</li>
            <li>Before/after photos</li>
            <li>Itemized invoice</li>
            <li>Your digital signature</li>
          </ul>

          <p style="text-align:center;margin-top:24px;">
            <a href="${data.reportUrl}" class="button">Download PDF Report</a>
          </p>

          <p style="text-align:center;margin-top:16px;">
            <a href="${SITE_URL}/review/${data.jobNumber}" style="color:#f97316;">Rate your experience with ${data.locksmithName}</a>
          </p>
        </div>
        <div class="footer">
          <p>Thank you for using LockSafe UK!</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Job Complete! Download your report (${data.jobNumber})`,
    html,
  });
}

// ============================================
// LOCKSMITH PAYOUT EMAILS
// ============================================

export async function sendPayoutNotificationEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    amount: number;
    currency: string;
    arrivalDate: string;
    bankLast4: string;
    payoutId: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .amount { font-size: 48px; font-weight: bold; color: #16a34a; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Payout Successful!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">Your earnings have been transferred</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>Great news! Your payout has been processed and is on its way to your bank account.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Amount Transferred</p>
            <p class="amount" style="margin:8px 0 0 0;">£${data.amount.toFixed(2)}</p>
          </div>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Bank Account</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;">•••• ${data.bankLast4}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Expected Arrival</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.arrivalDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Reference</td>
                <td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px;border-top:1px solid #e2e8f0;">${data.payoutId.slice(0, 20)}...</td>
              </tr>
            </table>
          </div>

          <p style="background:#ecfdf5;border:1px solid #bbf7d0;padding:12px 16px;border-radius:8px;color:#166534;font-size:14px;">
            <strong>Note:</strong> Bank transfers typically arrive within 1-2 business days, depending on your bank.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/earnings" class="button">View Earnings Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Questions? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Payout Sent: £${data.amount.toFixed(2)} on its way!`,
    html,
  });
}

export async function sendPayoutFailedEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    amount: number;
    currency: string;
    failureReason: string;
    failureCode: string;
    payoutId: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
        .button-secondary { display: inline-block; background: white; color: #f97316; padding: 12px 24px; border-radius: 8px; text-decoration: none; border: 2px solid #f97316; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Payout Failed</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">Action required to receive your earnings</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>Unfortunately, we were unable to process your payout of <strong>£${data.amount.toFixed(2)}</strong>.</p>

          <div class="box" style="background:#fef2f2;border:1px solid #fecaca;">
            <p style="margin:0;color:#991b1b;font-weight:600;">Reason for failure:</p>
            <p style="margin:8px 0 0 0;color:#dc2626;">${data.failureReason}</p>
            <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">Error code: ${data.failureCode}</p>
          </div>

          <p><strong>What to do next:</strong></p>
          <ol style="color:#475569;">
            <li>Check that your bank account details are correct in Stripe</li>
            <li>Ensure your bank account can receive deposits</li>
            <li>Contact your bank if the issue persists</li>
          </ol>

          <p>Once you've resolved the issue, your payout will be automatically retried within 24 hours.</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="https://dashboard.stripe.com" class="button" style="margin-right:8px;">Update Bank Details</a>
            <a href="mailto:${SUPPORT_EMAIL}" class="button-secondary">Contact Support</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Action Required: Payout of £${data.amount.toFixed(2)} failed`,
    html,
  });
}

export async function sendAccountVerifiedEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    accountId: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
        .checkmark { font-size: 48px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="text-align:center;">
          <div class="checkmark">✓</div>
          <h1 style="margin:8px 0 0 0;font-size:24px;">Account Verified!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">You're all set to receive payouts</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>Congratulations! Your Stripe account has been fully verified and you're now ready to receive automatic payouts for your completed jobs.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#16a34a;font-weight:600;font-size:18px;">What happens next?</p>
            <ul style="text-align:left;color:#475569;margin-top:12px;">
              <li>Complete jobs through LockSafe as usual</li>
              <li>Earnings are automatically transferred after each job</li>
              <li>Funds arrive in your bank account within 2-3 days</li>
            </ul>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">YOUR PAYOUT SCHEDULE</p>
            <p style="margin:8px 0 0 0;font-size:18px;font-weight:bold;">Weekly (Every Friday)</p>
            <p style="margin:4px 0 0 0;color:#64748b;">You can change this in your Stripe dashboard</p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/dashboard" class="button">Start Taking Jobs</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Questions? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Account Verified - You're ready to receive payouts!`,
    html,
  });
}

// Email to locksmith when they are booked by a customer
export async function sendLocksmithBookedEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    customerName: string;
    customerPhone: string;
    address: string;
    postcode: string;
    problemType: string;
    assessmentFee: number;
    jobId: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .urgent { background: #fef3c7; border: 2px solid #fcd34d; padding: 16px; border-radius: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">You've Been Booked!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Customer has paid and is waiting for you</p>
        </div>
        <div class="content">
          <div class="urgent">
            <p style="margin:0;font-size:18px;color:#92400e;font-weight:bold;">⚡ Customer is expecting you!</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Job Details</p>
            <table style="width:100%;margin-top:12px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Problem</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.problemType}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Assessment Fee</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;color:#16a34a;font-size:18px;border-top:1px solid #e2e8f0;">£${data.assessmentFee}</td>
              </tr>
            </table>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Customer</p>
            <p style="margin:8px 0;font-size:18px;font-weight:bold;">${data.customerName}</p>
            <p style="margin:0;">
              <a href="tel:${data.customerPhone}" style="color:#f97316;font-weight:600;font-size:16px;">${data.customerPhone}</a>
            </p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Location</p>
            <p style="margin:8px 0;font-weight:600;">${data.address}</p>
            <p style="margin:0;color:#475569;">${data.postcode}</p>
            <p style="margin:12px 0 0 0;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.address + ", " + data.postcode)}" style="color:#f97316;font-weight:600;">📍 Open in Google Maps</a>
            </p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/job/${data.jobId}/work" class="button">View Job Details</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Remember:</strong> Confirm your arrival using GPS when you get to the location. This protects both you and the customer.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `🔔 NEW BOOKING: ${data.problemType} at ${data.postcode} - £${data.assessmentFee} (${data.jobNumber})`,
    html,
  });
}

// Email to customer when work is complete and needs confirmation
export async function sendWorkCompletionConfirmationEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    jobId: string;
    locksmithName: string;
    quoteTotal: number;
    address: string;
    confirmationUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px; }
        .urgent { background: #dbeafe; border: 2px solid #93c5fd; padding: 16px; border-radius: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Work Completed!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Please confirm and sign to complete your job</p>
        </div>
        <div class="content">
          <div class="urgent">
            <p style="margin:0;font-size:18px;color:#1e40af;font-weight:bold;">Your locksmith has finished the work</p>
            <p style="margin:8px 0 0 0;color:#3b82f6;">Please review and sign to confirm completion</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Job Summary</p>
            <table style="width:100%;margin-top:12px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Locksmith</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.locksmithName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;">${data.address}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Amount Due</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">£${data.quoteTotal.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="box" style="background:#fef3c7;border:1px solid #fcd34d;">
            <p style="margin:0;color:#92400e;font-weight:600;">What happens next:</p>
            <ol style="margin:12px 0 0 0;color:#78350f;padding-left:20px;">
              <li>Click the button below to review the work</li>
              <li>Sign digitally to confirm you're satisfied</li>
              <li>Your card will be charged automatically</li>
              <li>Receive your legal documentation</li>
            </ol>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${data.confirmationUrl}" class="button">Confirm & Sign</a>
          </p>

          <p style="text-align:center;color:#64748b;font-size:14px;margin-top:16px;">
            If you have any issues with the work, please contact the locksmith before signing.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Action Required: Confirm work completion - ${data.jobNumber}`,
    html,
  });
}

export async function sendTransferNotificationEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    amount: number;
    jobNumber: string;
    customerName: string;
    platformFee: number;
    paymentType?: "assessment_fee" | "work_quote";
    totalCharged?: number;
  }
) {
  // Calculate commission rate based on payment type
  const commissionRate = data.paymentType === "work_quote" ? 25 : 15;
  const totalCharged = data.totalCharged || (data.amount + data.platformFee);
  const paymentLabel = data.paymentType === "work_quote" ? "Work Payment" : "Assessment Fee";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .earnings { font-size: 42px; font-weight: bold; color: #16a34a; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Payment Received!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">${paymentLabel} for Job ${data.jobNumber}</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>Great news! You've received a ${paymentLabel.toLowerCase()} for job <strong>${data.jobNumber}</strong>.</p>

          <div class="box" style="text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;">
            <p style="margin:0;color:#64748b;font-size:14px;">YOUR EARNINGS</p>
            <p class="earnings" style="margin:8px 0 0 0;">£${data.amount.toFixed(2)}</p>
            <p style="margin:8px 0 0 0;color:#16a34a;font-weight:500;">Added to your balance</p>
          </div>

          <div class="box">
            <p style="margin:0 0 16px 0;font-weight:600;color:#1e293b;">Payment Breakdown</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Customer Paid</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;">£${totalCharged.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Platform Commission (${commissionRate}%)</td>
                <td style="padding:12px 0;text-align:right;color:#f97316;">-£${data.platformFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0 0;font-weight:700;font-size:16px;color:#16a34a;">Your Earnings (${100 - commissionRate}%)</td>
                <td style="padding:16px 0 0 0;text-align:right;font-weight:700;font-size:18px;color:#16a34a;">£${data.amount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Customer</td>
                <td style="padding:10px 0;text-align:right;font-weight:600;">${data.customerName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Job Number</td>
                <td style="padding:10px 0;text-align:right;font-family:monospace;font-weight:600;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#64748b;">Payment Type</td>
                <td style="padding:10px 0;text-align:right;">${paymentLabel}</td>
              </tr>
            </table>
          </div>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;">
            This amount has been added to your available balance and will be included in your next payout.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/earnings" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Your Earnings</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Payment Received: £${data.amount.toFixed(2)} for ${data.jobNumber}`,
    html,
  });
}

// ============================================
// PAYMENT RECEIPT EMAILS
// ============================================

export async function sendPaymentReceiptEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    paymentType: "assessment_fee" | "work_quote";
    quoteTotal: number;
    assessmentFeeDeducted: number;
    amountPaid: number;
    paymentDate: Date;
    address: string;
  }
) {
  const paymentTypeLabel = data.paymentType === "assessment_fee" ? "Assessment Fee" : "Work Payment";
  const dateStr = data.paymentDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; border: 1px solid #e2e8f0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .amount-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
        .total-row { display: flex; justify-content: space-between; padding: 12px 0; border-top: 2px solid #e2e8f0; margin-top: 8px; }
        .deduction { color: #16a34a; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Payment Receipt</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">${paymentTypeLabel}</p>
        </div>
        <div class="content">
          <p>Hi ${data.customerName},</p>
          <p>Thank you for your payment. Here's your receipt for job <strong>${data.jobNumber}</strong>.</p>

          <div class="box" style="text-align:center;background:#f0fdf4;border-color:#bbf7d0;">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;">AMOUNT PAID</p>
            <p style="margin:8px 0 0 0;font-size:42px;font-weight:bold;color:#16a34a;">£${data.amountPaid.toFixed(2)}</p>
            <p style="margin:8px 0 0 0;color:#64748b;font-size:14px;">${dateStr}</p>
          </div>

          ${data.paymentType === "work_quote" && data.assessmentFeeDeducted > 0 ? `
          <div class="box">
            <p style="margin:0 0 16px 0;font-weight:600;color:#1e293b;">Payment Breakdown</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Work Quote Total</td>
                <td style="padding:12px 0;text-align:right;font-weight:500;">£${data.quoteTotal.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#16a34a;">Assessment Fee Applied</td>
                <td style="padding:12px 0;text-align:right;font-weight:500;color:#16a34a;">-£${data.assessmentFeeDeducted.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0 0;font-weight:700;font-size:18px;">Amount Charged</td>
                <td style="padding:16px 0 0 0;text-align:right;font-weight:700;font-size:18px;color:#f97316;">£${data.amountPaid.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          ` : ""}

          <div class="box">
            <p style="margin:0 0 12px 0;font-weight:600;color:#1e293b;">Job Details</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Job Number</td>
                <td style="padding:10px 0;text-align:right;font-family:monospace;font-weight:600;">${data.jobNumber}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Locksmith</td>
                <td style="padding:10px 0;text-align:right;">${data.locksmithName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Location</td>
                <td style="padding:10px 0;text-align:right;">${data.address}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#64748b;">Payment Type</td>
                <td style="padding:10px 0;text-align:right;">${paymentTypeLabel}</td>
              </tr>
            </table>
          </div>

          <p style="color:#64748b;font-size:14px;text-align:center;">
            A copy of this receipt has been saved to your account.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/customer/job/${data.jobNumber}" style="display:inline-block;background:#f97316;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">View Job Details</a>
          </p>
        </div>
        <div class="footer">
          <p style="margin:0;">LockSafe UK - Emergency Locksmith Service</p>
          <p style="margin:8px 0 0 0;">Anti-fraud protected with GPS tracking and digital documentation</p>
          <p style="margin:16px 0 0 0;font-size:10px;color:#94a3b8;">This is an automated receipt. Please keep this email for your records.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Payment Receipt: £${data.amountPaid.toFixed(2)} - ${data.jobNumber}`,
    html,
  });
}

// ============================================
// QUOTE DECISION EMAILS (TO LOCKSMITH)
// ============================================

export async function sendQuoteAcceptedEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    customerName: string;
    quoteTotal: number;
    address: string;
    jobId: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .success { background: #f0fdf4; border: 2px solid #bbf7d0; padding: 16px; border-radius: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Quote Accepted!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">You're approved to begin work</p>
        </div>
        <div class="content">
          <div class="success">
            <p style="margin:0;font-size:18px;color:#16a34a;font-weight:bold;">Customer has accepted your quote</p>
          </div>

          <p>Hi ${data.locksmithName},</p>
          <p>Great news! ${data.customerName} has approved your quote and you're now cleared to proceed with the work.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Job Details</p>
            <table style="width:100%;margin-top:12px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Customer</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.customerName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;">${data.address}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Quote Total</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">£${data.quoteTotal.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/job/${data.jobId}/work" class="button">Start Work</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Reminder:</strong> When work is complete, mark the job as finished in the app. The customer will then sign to confirm and payment will be processed automatically.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Quote Accepted! Start work on ${data.jobNumber}`,
    html,
  });
}

export async function sendQuoteDeclinedEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    customerName: string;
    quoteTotal: number;
    address: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #475569; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Quote Declined</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${data.jobNumber}</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>${data.customerName} has decided not to proceed with the work at this time. The assessment fee has already been paid for your time.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Job Summary</p>
            <table style="width:100%;margin-top:12px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;">${data.address}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Quote Amount</td>
                <td style="padding:8px 0;text-align:right;text-decoration:line-through;color:#94a3b8;border-top:1px solid #e2e8f0;">£${data.quoteTotal.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="background:#f0fdf4;border:1px solid #bbf7d0;padding:12px 16px;border-radius:8px;color:#166534;font-size:14px;">
            <strong>Good news:</strong> Your assessment fee has been paid. This amount will be included in your next payout.
          </p>

          <p style="color:#64748b;font-size:14px;margin-top:16px;">
            Don't worry - this happens sometimes. Keep checking for new jobs in your area!
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Quote Declined - ${data.jobNumber}`,
    html,
  });
}

// ============================================
// REVIEW NOTIFICATION EMAIL (TO LOCKSMITH)
// ============================================

export async function sendNewReviewEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    customerName: string;
    rating: number;
    comment: string | null;
  }
) {
  const stars = "★".repeat(data.rating) + "☆".repeat(5 - data.rating);
  const ratingColor = data.rating >= 4 ? "#16a34a" : data.rating >= 3 ? "#f97316" : "#dc2626";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .stars { font-size: 32px; color: ${ratingColor}; letter-spacing: 2px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">New Review Received!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">From ${data.customerName}</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>${data.customerName} left a review for job ${data.jobNumber}.</p>

          <div class="box" style="text-align:center;">
            <p class="stars">${stars}</p>
            <p style="margin:8px 0 0 0;font-size:24px;font-weight:bold;color:${ratingColor};">${data.rating}/5 Stars</p>
          </div>

          ${data.comment ? `
          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Customer Review</p>
            <p style="margin:12px 0 0 0;font-style:italic;color:#475569;">"${data.comment}"</p>
          </div>
          ` : ""}

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/reviews" class="button">View All Reviews</a>
          </p>

          <p style="color:#64748b;font-size:14px;text-align:center;margin-top:16px;">
            Great reviews help you get more jobs. Keep up the excellent work!
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `New ${data.rating}-Star Review from ${data.customerName}`,
    html,
  });
}

// ============================================
// LOCKSMITH ARRIVED NOTIFICATION (TO CUSTOMER)
// ============================================

export async function sendLocksmithArrivedEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    locksmithPhone: string;
    address: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .arrived { background: #f0fdf4; border: 2px solid #bbf7d0; padding: 20px; border-radius: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Locksmith Has Arrived!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${data.jobNumber}</p>
        </div>
        <div class="content">
          <div class="arrived">
            <p style="margin:0;font-size:40px;">📍</p>
            <p style="margin:8px 0 0 0;font-size:18px;color:#16a34a;font-weight:bold;">${data.locksmithName} has arrived at your location</p>
          </div>

          <p>Hi ${data.customerName},</p>
          <p>Your locksmith has arrived and checked in at ${data.address}. They will now assess the issue and provide you with a quote.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Locksmith</p>
            <p style="margin:8px 0;font-size:18px;font-weight:bold;">${data.locksmithName}</p>
            <p style="margin:0;">
              <a href="tel:${data.locksmithPhone}" style="color:#f97316;font-weight:600;font-size:16px;">${data.locksmithPhone}</a>
            </p>
          </div>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;">
            <strong>What happens next:</strong>
            <ol style="margin:8px 0 0 0;padding-left:20px;">
              <li>The locksmith will assess the lock issue</li>
              <li>You'll receive a detailed quote</li>
              <li>Accept or decline with no obligation</li>
            </ol>
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/customer/job/${data.jobNumber}" class="button">Track Your Job</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `${data.locksmithName} has arrived! - ${data.jobNumber}`,
    html,
  });
}

// ============================================
// NEW JOB IN AREA NOTIFICATION
// ============================================

export async function sendNewJobInAreaEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    problemType: string;
    postcode: string;
    address: string;
    distanceMiles: number;
    propertyType?: string;
    createdAt: string;
  }
) {
  const problemLabels: Record<string, string> = {
    lockout: "Locked Out",
    broken: "Broken Lock",
    "key-stuck": "Key Stuck",
    "lost-keys": "Lost Keys",
    burglary: "After Burglary",
    other: "Other Issue",
  };

  const propertyLabels: Record<string, string> = {
    house: "House",
    flat: "Flat/Apartment",
    commercial: "Commercial",
    car: "Vehicle",
  };

  const problemLabel = problemLabels[data.problemType] || data.problemType;
  const propertyLabel = data.propertyType ? propertyLabels[data.propertyType] || data.propertyType : "Property";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
        .distance { display: inline-block; background: #fef3c7; color: #b45309; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 14px; }
        .urgent { background: #fee2e2; border: 2px solid #fca5a5; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
        .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #64748b; font-size: 14px; }
        .detail-value { font-weight: 600; color: #1e293b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <p style="margin:0;font-size:14px;opacity:0.9;text-transform:uppercase;letter-spacing:1px;">New Job Alert</p>
          <h1 style="margin:8px 0 0 0;font-size:28px;">${problemLabel}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">${data.postcode} • <span class="distance">${data.distanceMiles} miles away</span></p>
        </div>
        <div class="content">
          <div class="urgent">
            <p style="margin:0;color:#dc2626;font-weight:600;">⚡ Customer waiting for a locksmith!</p>
          </div>

          <p>Hi ${data.locksmithName},</p>
          <p>A new job has just been posted in your coverage area. Be one of the first to apply!</p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;">Job Reference</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Problem Type</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${problemLabel}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Property</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${propertyLabel}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.postcode}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Distance</td>
                <td style="padding:12px 0;text-align:right;border-top:1px solid #e2e8f0;">
                  <span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:20px;font-weight:600;font-size:14px;">${data.distanceMiles} miles</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;">
            <strong>Quick Tip:</strong> Jobs with faster response times and competitive assessment fees tend to get accepted more often!
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/jobs" class="button">View & Apply Now →</a>
          </p>

          <p style="text-align:center;color:#64748b;font-size:12px;margin-top:16px;">
            Apply quickly before other locksmiths do!
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p style="margin-top:8px;">
            <a href="${SITE_URL}/locksmith/settings" style="color:#f97316;text-decoration:none;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `🔔 New Job: ${problemLabel} in ${data.postcode} (${data.distanceMiles} mi)`,
    html,
  });
}

// ============================================
// AUTO-DISPATCH NOTIFICATION
// ============================================

export async function sendAutoDispatchEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    jobId: string;
    problemType: string;
    propertyType: string;
    postcode: string;
    address: string;
    customerName: string;
    assessmentFee: number;
  }
) {
  const problemLabels: Record<string, string> = {
    lockout: "Locked Out",
    broken: "Broken Lock",
    "key-stuck": "Key Stuck",
    "lost-keys": "Lost Keys",
    burglary: "After Burglary",
    other: "Other Issue",
  };

  const problemLabel = problemLabels[data.problemType] || data.problemType;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }
        .auto-dispatch-badge { background: #dcfce7; border: 2px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <p style="margin:0;font-size:14px;opacity:0.9;text-transform:uppercase;letter-spacing:1px;">Auto-Dispatch</p>
          <h1 style="margin:8px 0 0 0;font-size:28px;">Job Assigned to You!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">${data.postcode} • ${problemLabel}</p>
        </div>
        <div class="content">
          <div class="auto-dispatch-badge">
            <p style="margin:0;color:#166534;font-weight:600;">✨ You've been auto-matched to this job based on your location and rating!</p>
          </div>

          <p>Hi ${data.locksmithName},</p>
          <p>Our intelligent matching system has assigned you to a new job. The customer is waiting for you!</p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;">Job Reference</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Customer</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.customerName}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Problem</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${problemLabel}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.address}<br><span style="color:#64748b;">${data.postcode}</span></td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Assessment Fee</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">
                  <span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:20px;">£${data.assessmentFee.toFixed(2)}</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="background:#fef3c7;border:1px solid #fde68a;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;">
            <strong>Action Required:</strong> Please accept this job and head to the customer as soon as possible. Mark yourself as "En Route" when you leave.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${SITE_URL}/locksmith/job/${data.jobId}" class="button">View Job Details →</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Intelligent Dispatch System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `🎯 AUTO-DISPATCH: Job ${data.jobNumber} assigned to you!`,
    html,
  });
}

// ============================================
// SIGNATURE REMINDER & AUTO-COMPLETION EMAILS
// ============================================

export async function sendSignatureReminderEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    totalAmount: number;
    confirmUrl: string;
    timeRemaining: string;
    reminderNumber: number;
  }
) {
  const isUrgent = data.reminderNumber >= 3;
  const headerBg = isUrgent
    ? "background: linear-gradient(135deg, #dc2626, #b91c1c);"
    : "background: linear-gradient(135deg, #f97316, #ea580c);";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { ${headerBg} color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px; }
        .urgent { background: #fef2f2; border: 2px solid #fecaca; padding: 16px; border-radius: 12px; text-align: center; }
        .timer { font-size: 28px; font-weight: bold; color: ${isUrgent ? "#dc2626" : "#f97316"}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">${isUrgent ? "⚠️ Urgent: Signature Required" : "Reminder: Please Sign Off"}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${data.jobNumber}</p>
        </div>
        <div class="content">
          ${isUrgent ? `
          <div class="urgent">
            <p class="timer">⏰ ${data.timeRemaining} remaining</p>
            <p style="margin:8px 0 0 0;color:#991b1b;font-weight:500;">Your job will be auto-completed if not signed</p>
          </div>
          ` : `
          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;">Time Remaining</p>
            <p class="timer">${data.timeRemaining}</p>
          </div>
          `}

          <p>Hi ${data.customerName},</p>
          <p>${data.locksmithName} has completed the work on your job and is waiting for your confirmation.</p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Job Number</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Locksmith</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.locksmithName}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Amount Due</td>
                <td style="padding:12px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">£${data.totalAmount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="box" style="background:#fef3c7;border:1px solid #fcd34d;">
            <p style="margin:0;color:#92400e;font-weight:600;">Why is this important?</p>
            <ul style="margin:12px 0 0 0;color:#78350f;padding-left:20px;">
              <li>Your signature confirms the work is complete</li>
              <li>Payment will be processed securely</li>
              <li>You'll receive a legal PDF report</li>
              ${isUrgent ? "<li><strong>Auto-completion happens after 24 hours</strong></li>" : ""}
            </ul>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${data.confirmUrl}" class="button">Confirm & Sign Now →</a>
          </p>

          <p style="text-align:center;color:#64748b;font-size:14px;margin-top:16px;">
            If you have any issues with the work, please contact the locksmith directly.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const urgencyLabel = isUrgent ? "⚠️ URGENT" : `Reminder ${data.reminderNumber}`;

  return sendEmail({
    to: customerEmail,
    subject: `${urgencyLabel}: Please sign off job ${data.jobNumber} - ${data.timeRemaining} remaining`,
    html,
  });
}

export async function sendAutoCompletionEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    locksmithName: string;
    totalAmount: number;
    reportUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #475569, #334155); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .notice { background: #fef3c7; border: 2px solid #fcd34d; padding: 16px; border-radius: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Job Auto-Completed</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${data.jobNumber}</p>
        </div>
        <div class="content">
          <div class="notice">
            <p style="margin:0;color:#92400e;font-weight:600;">⏰ Your job was automatically completed</p>
            <p style="margin:8px 0 0 0;color:#78350f;font-size:14px;">
              The 24-hour confirmation period has expired without a response.
            </p>
          </div>

          <p>Hi ${data.customerName},</p>
          <p>
            Since we didn't receive your signature within 24 hours of ${data.locksmithName} completing the work,
            your job has been automatically completed and payment has been processed.
          </p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Job Number</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Locksmith</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.locksmithName}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Amount Charged</td>
                <td style="padding:12px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">£${data.totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Status</td>
                <td style="padding:12px 0;text-align:right;border-top:1px solid #e2e8f0;">
                  <span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">Auto-Completed</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${data.reportUrl}" class="button">View Job Details</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Have concerns?</strong> If you're not satisfied with the work, please contact our support team at ${SUPPORT_EMAIL} within 48 hours.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Job ${data.jobNumber} Auto-Completed - Payment Processed`,
    html,
  });
}

// ============================================
// EARNINGS REVERSAL NOTIFICATION
// ============================================

/**
 * Send notification to locksmith when their earnings are reversed due to a refund
 */
export async function sendEarningsReversalEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    jobId: string;
    customerName: string;
    originalAmount: number;
    reversedAmount: number;
    reason: string;
    refundDate: Date;
  }
) {
  const reportUrl = `${SITE_URL}/job/${data.jobId}/report`;
  const earningsUrl = `${SITE_URL}/locksmith/earnings`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .alert-box { background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .button-secondary { display: inline-block; background: white; color: #475569; padding: 12px 24px; border-radius: 8px; text-decoration: none; border: 1px solid #e2e8f0; margin-left: 8px; }
        .amount { font-size: 32px; font-weight: 700; color: #dc2626; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Earnings Reversal Notice</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">A refund has been processed</p>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>We're writing to inform you that a refund has been processed for job <strong>${data.jobNumber}</strong>, and your earnings have been adjusted accordingly.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;">Amount Reversed</p>
            <p class="amount" style="margin:8px 0;">-£${data.reversedAmount.toFixed(2)}</p>
            <p style="margin:0;color:#64748b;font-size:12px;">This has been deducted from your balance</p>
          </div>

          <div class="alert-box">
            <p style="margin:0;font-weight:600;color:#991b1b;">Reason for refund:</p>
            <p style="margin:8px 0 0 0;color:#dc2626;">${data.reason}</p>
          </div>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Customer</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.customerName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Original Payment</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">£${data.originalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Your Share Reversed</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;color:#dc2626;border-top:1px solid #e2e8f0;">-£${data.reversedAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Refund Date</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.refundDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
              </tr>
            </table>
          </div>

          <p style="color:#64748b;font-size:14px;">
            This reversal has been automatically processed through Stripe Connect. The amount has been deducted from your connected account balance.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${earningsUrl}" class="button">View Your Earnings</a>
            <a href="${reportUrl}" class="button-secondary">View Job Details</a>
          </p>

          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;margin-top:24px;">
            <strong>Questions?</strong> If you believe this refund was made in error, please contact our support team at ${SUPPORT_EMAIL} within 48 hours with the job number.
          </p>
        </div>
        <div class="footer">
          <p>${SITE_NAME} - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Earnings Reversed: -£${data.reversedAmount.toFixed(2)} for Job ${data.jobNumber}`,
    html,
  });
}

// ============================================
// LOCKSMITH JOB COMPLETION SUMMARY EMAIL
// ============================================

/**
 * Send comprehensive job completion summary to locksmith with full earnings breakdown
 */
export async function sendLocksmithJobCompletionEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    jobNumber: string;
    jobId: string;
    customerName: string;
    address: string;
    completedAt: Date;
    assessmentFee: number;
    assessmentCommission: number;
    workQuoteTotal: number;
    workCommission: number;
    totalCustomerPaid: number;
    totalEarnings: number;
  }
) {
  const reportUrl = `${SITE_URL}/job/${data.jobId}/report`;
  const earningsUrl = `${SITE_URL}/locksmith/earnings`;
  const dateStr = data.completedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const assessmentEarnings = data.assessmentFee - data.assessmentCommission;
  const workEarnings = data.workQuoteTotal - data.workCommission;
  const totalCommission = data.assessmentCommission + data.workCommission;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .earnings-total { font-size: 48px; font-weight: bold; color: #16a34a; }
        .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 14px; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:36px;margin-bottom:8px;">✓</div>
          <h1 style="margin:0;font-size:28px;">Job Completed!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Here's your earnings summary</p>
          <div class="badge">
            <span>Job ${data.jobNumber}</span>
          </div>
        </div>
        <div class="content">
          <p>Hi ${data.locksmithName},</p>
          <p>Congratulations! You've successfully completed a job for ${data.customerName}. Here's your detailed earnings breakdown.</p>

          <div class="box" style="text-align:center;background:linear-gradient(135deg, #f0fdf4, #dcfce7);border:2px solid #16a34a;">
            <p style="margin:0;color:#166534;font-size:14px;text-transform:uppercase;letter-spacing:1px;">TOTAL EARNINGS</p>
            <p class="earnings-total" style="margin:8px 0 0 0;">£${data.totalEarnings.toFixed(2)}</p>
            <p style="margin:8px 0 0 0;color:#166534;font-size:14px;">Added to your balance</p>
          </div>

          <div class="box">
            <p style="margin:0 0 16px 0;font-weight:700;color:#1e293b;font-size:16px;">Commission Breakdown</p>

            <!-- Assessment Fee Section -->
            <div style="background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:12px;">
              <p style="margin:0;font-weight:600;color:#475569;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Assessment Fee (15% Commission)</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;">Customer Paid</td>
                  <td style="padding:6px 0;text-align:right;font-weight:500;">£${data.assessmentFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;">Platform Fee (15%)</td>
                  <td style="padding:6px 0;text-align:right;color:#f97316;">-£${data.assessmentCommission.toFixed(2)}</td>
                </tr>
                <tr style="border-top:1px dashed #e2e8f0;">
                  <td style="padding:8px 0 0 0;color:#16a34a;font-weight:600;">Your Earnings (85%)</td>
                  <td style="padding:8px 0 0 0;text-align:right;color:#16a34a;font-weight:600;">£${assessmentEarnings.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            ${data.workQuoteTotal > 0 ? `
            <!-- Work Quote Section -->
            <div style="background:#f8fafc;padding:16px;border-radius:8px;">
              <p style="margin:0;font-weight:600;color:#475569;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">Work Quote (25% Commission)</p>
              <table style="width:100%;border-collapse:collapse;margin-top:8px;">
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;">Customer Paid</td>
                  <td style="padding:6px 0;text-align:right;font-weight:500;">£${data.workQuoteTotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#64748b;font-size:14px;">Platform Fee (25%)</td>
                  <td style="padding:6px 0;text-align:right;color:#f97316;">-£${data.workCommission.toFixed(2)}</td>
                </tr>
                <tr style="border-top:1px dashed #e2e8f0;">
                  <td style="padding:8px 0 0 0;color:#16a34a;font-weight:600;">Your Earnings (75%)</td>
                  <td style="padding:8px 0 0 0;text-align:right;color:#16a34a;font-weight:600;">£${workEarnings.toFixed(2)}</td>
                </tr>
              </table>
            </div>
            ` : ""}
          </div>

          <div class="box">
            <p style="margin:0 0 12px 0;font-weight:700;color:#1e293b;">Summary</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Total Customer Paid</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;">£${data.totalCustomerPaid.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Total Platform Commission</td>
                <td style="padding:12px 0;text-align:right;color:#f97316;">-£${totalCommission.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0 0;font-weight:700;font-size:18px;color:#16a34a;">Your Total Earnings</td>
                <td style="padding:16px 0 0 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;">£${data.totalEarnings.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="box">
            <p style="margin:0 0 12px 0;font-weight:600;color:#1e293b;">Job Details</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Job Number</td>
                <td style="padding:10px 0;text-align:right;font-family:monospace;font-weight:600;">${data.jobNumber}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Customer</td>
                <td style="padding:10px 0;text-align:right;font-weight:600;">${data.customerName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Location</td>
                <td style="padding:10px 0;text-align:right;">${data.address}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#64748b;">Completed</td>
                <td style="padding:10px 0;text-align:right;">${dateStr}</td>
              </tr>
            </table>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${earningsUrl}" class="button" style="margin-right:8px;">View Earnings</a>
            <a href="${reportUrl}" style="display:inline-block;background:white;color:#475569;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;border:1px solid #e2e8f0;">View Job Report</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Commission Rates:</strong> Assessment fees have a 15% platform commission, work quotes have a 25% commission. Your earnings are automatically transferred to your connected bank account.
          </p>
        </div>
        <div class="footer">
          <p>${SITE_NAME} - Locksmith Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `Job Complete! You earned £${data.totalEarnings.toFixed(2)} - ${data.jobNumber}`,
    html,
  });
}

// ============================================
// PHONE REQUEST CONTINUATION EMAIL
// ============================================

/**
 * Send email to customer after phone call with link to complete their request
 */
export async function sendPhoneRequestContinuationEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    continueUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px; }
        .urgent { background: #fef3c7; border: 2px solid #fcd34d; padding: 16px; border-radius: 12px; text-align: center; }
        .reference { font-family: monospace; font-size: 24px; font-weight: bold; color: #f97316; letter-spacing: 2px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">Complete Your Emergency Request</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">We spoke with you on the phone</p>
        </div>
        <div class="content">
          <div class="urgent">
            <p style="margin:0;font-size:18px;color:#92400e;font-weight:bold;">Your request has been registered</p>
            <p style="margin:8px 0 0 0;color:#78350f;">Complete your request to get a locksmith dispatched</p>
          </div>

          <p>Hi ${data.customerName},</p>
          <p>Thank you for calling LockSafe UK. We've registered your emergency locksmith request.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Reference Number</p>
            <p class="reference" style="margin:8px 0 0 0;">${data.jobNumber}</p>
          </div>

          <div class="box">
            <p style="margin:0;font-weight:600;color:#1e293b;">To get a locksmith to your location:</p>
            <ol style="margin:12px 0 0 0;color:#475569;padding-left:20px;">
              <li>Click the button below</li>
              <li>Confirm your address on the map</li>
              <li>Select the exact service you need</li>
              <li>Review and submit your request</li>
            </ol>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${data.continueUrl}" class="button">Complete Your Request</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>What happens next?</strong> Once you submit your request, local verified locksmiths will see your job and send you quotes with their assessment fee and ETA. You choose the best one for you.
          </p>

          <p style="text-align:center;color:#64748b;font-size:12px;margin-top:16px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${data.continueUrl}" style="color:#f97316;word-break:break-all;">${data.continueUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>24/7 Emergency Service | Anti-fraud protected</p>
          <p style="margin-top:8px;">Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Complete Your Emergency Request - ${data.jobNumber}`,
    html,
  });
}

// ============================================
// LOCKSMITH VERIFICATION EMAIL
// ============================================

export async function sendLocksmithVerifiedEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    companyName: string | null;
  }
) {
  const dashboardUrl = `${SITE_URL}/locksmith/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 50px; margin-top: 16px; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .benefits { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; }
        .benefit-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
        .benefit-item:last-child { border-bottom: none; }
        .benefit-icon { width: 32px; height: 32px; background: #dcfce7; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:48px;margin-bottom:8px;">🎉</div>
          <h1 style="margin:0;font-size:28px;">Congratulations!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:18px;">Your Account Has Been Verified</p>
          <div class="badge">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            <span style="font-weight:600;">Verified Locksmith</span>
          </div>
        </div>
        <div class="content">
          <p style="font-size:18px;">Hi ${data.locksmithName},</p>

          <p>Great news! Your LockSafe UK account${data.companyName ? ` for <strong>${data.companyName}</strong>` : ''} has been reviewed and <strong style="color:#16a34a;">verified by our team</strong>.</p>

          <div class="box" style="text-align:center;background:linear-gradient(135deg, #dcfce7, #d1fae5);border:2px solid #16a34a;">
            <p style="margin:0;font-size:16px;color:#166534;font-weight:600;">
              ✓ Your verified badge is now visible to all customers
            </p>
          </div>

          <div class="benefits">
            <p style="margin:0 0 12px 0;font-weight:600;color:#1e293b;">What this means for you:</p>

            <div class="benefit-item">
              <div class="benefit-icon">
                <span style="font-size:16px;">🛡️</span>
              </div>
              <div>
                <p style="margin:0;font-weight:600;color:#1e293b;">Verified Badge</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Your profile now displays a verified badge, building trust with customers.</p>
              </div>
            </div>

            <div class="benefit-item">
              <div class="benefit-icon">
                <span style="font-size:16px;">📈</span>
              </div>
              <div>
                <p style="margin:0;font-weight:600;color:#1e293b;">Higher Visibility</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Verified locksmiths are preferred by customers looking for trusted professionals.</p>
              </div>
            </div>

            <div class="benefit-item">
              <div class="benefit-icon">
                <span style="font-size:16px;">⚡</span>
              </div>
              <div>
                <p style="margin:0;font-weight:600;color:#1e293b;">More Job Opportunities</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Customers see your verified status when selecting a locksmith, increasing your chances of being chosen.</p>
              </div>
            </div>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${dashboardUrl}" class="button">Go to Your Dashboard</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Tip:</strong> Make sure your profile is complete and your coverage area is set correctly to receive the most relevant job notifications.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Partner Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: locksmithEmail,
    subject: `🎉 Congratulations! Your LockSafe Account is Now Verified`,
    html,
  });
}

// ============================================
// INSURANCE EXPIRY REMINDER EMAIL
// ============================================

/**
 * Send email to locksmith when their insurance is expiring soon
 */
export async function sendInsuranceExpiryReminderEmail(
  locksmithEmail: string,
  data: {
    locksmithName: string;
    companyName: string | null;
    expiryDate: Date;
    daysUntilExpiry: number;
    renewUrl: string;
  }
) {
  const isUrgent = data.daysUntilExpiry <= 7;
  const headerBg = isUrgent
    ? "background: linear-gradient(135deg, #dc2626, #b91c1c);"
    : "background: linear-gradient(135deg, #f97316, #ea580c);";

  const urgencyText = data.daysUntilExpiry <= 0
    ? "has expired"
    : data.daysUntilExpiry === 1
    ? "expires tomorrow"
    : `expires in ${data.daysUntilExpiry} days`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { ${headerBg} color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .alert { background: ${isUrgent ? "#fef2f2" : "#fef3c7"}; border: 2px solid ${isUrgent ? "#fecaca" : "#fcd34d"}; padding: 16px; border-radius: 12px; text-align: center; }
        .countdown { font-size: 48px; font-weight: bold; color: ${isUrgent ? "#dc2626" : "#f97316"}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">⚠️ Insurance ${data.daysUntilExpiry <= 0 ? "Expired" : "Expiring Soon"}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Action required for your LockSafe account</p>
        </div>
        <div class="content">
          <div class="alert">
            <p class="countdown">${data.daysUntilExpiry <= 0 ? "EXPIRED" : data.daysUntilExpiry}</p>
            <p style="margin:0;color:${isUrgent ? "#991b1b" : "#92400e"};font-weight:600;">
              ${data.daysUntilExpiry <= 0 ? "Your insurance has expired" : `day${data.daysUntilExpiry === 1 ? "" : "s"} until expiry`}
            </p>
          </div>

          <p>Hi ${data.locksmithName},</p>
          <p>
            Your public liability insurance certificate ${urgencyText}.
            ${data.daysUntilExpiry <= 0
              ? "Your account has been restricted until you upload a valid insurance document."
              : "Please renew your insurance and upload the new certificate to continue accepting jobs without interruption."}
          </p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Current Expiry Date</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;${isUrgent ? "color:#dc2626;" : ""}">${data.expiryDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</td>
              </tr>
              ${data.companyName ? `
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Company</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${data.companyName}</td>
              </tr>
              ` : ""}
            </table>
          </div>

          <div class="box" style="background:${isUrgent ? "#fef2f2" : "#f0fdf4"};border:1px solid ${isUrgent ? "#fecaca" : "#bbf7d0"};">
            <p style="margin:0;color:${isUrgent ? "#991b1b" : "#166534"};font-weight:600;">
              ${isUrgent ? "⚠️ Urgent Action Required" : "✓ What to do next"}
            </p>
            <ol style="margin:12px 0 0 0;color:${isUrgent ? "#dc2626" : "#15803d"};padding-left:20px;">
              <li>Renew your insurance with your provider</li>
              <li>Log in to your LockSafe account</li>
              <li>Go to Settings → Insurance & Documentation</li>
              <li>Upload your new insurance certificate</li>
              <li>Enter the new expiry date</li>
            </ol>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${data.renewUrl}" class="button">Update Insurance Now</a>
          </p>

          ${data.daysUntilExpiry <= 0 ? `
          <p style="background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;color:#991b1b;font-size:14px;margin-top:24px;">
            <strong>Important:</strong> Your ability to accept new jobs has been suspended until valid insurance is provided.
            Upload your renewed insurance certificate to restore your account.
          </p>
          ` : data.daysUntilExpiry <= 7 ? `
          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;margin-top:24px;">
            <strong>Note:</strong> If your insurance expires before you renew, your ability to accept new jobs will be temporarily suspended.
          </p>
          ` : ""}
        </div>
        <div class="footer">
          <p>${SITE_NAME} - Locksmith Partner Portal</p>
          <p>Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const subjectPrefix = isUrgent ? "🚨 URGENT" : "⚠️ Reminder";
  const subjectSuffix = data.daysUntilExpiry <= 0
    ? "Insurance Expired - Action Required"
    : `Insurance ${urgencyText}`;

  return sendEmail({
    to: locksmithEmail,
    subject: `${subjectPrefix}: ${subjectSuffix}`,
    html,
  });
}

// ============================================
// CUSTOMER ONBOARDING EMAILS (Admin Created Jobs)
// ============================================

/**
 * Send onboarding email to new customer when admin creates a job for them
 */
export async function sendCustomerOnboardingEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    jobAddress: string;
    problemType: string;
    onboardingUrl: string;
  }
) {
  const problemLabels: Record<string, string> = {
    lockout: "Locked Out",
    broken: "Broken Lock",
    "key-stuck": "Key Stuck",
    "lost-keys": "Lost Keys",
    burglary: "After Burglary",
    other: "Other Issue",
  };

  const problemLabel = problemLabels[data.problemType] || data.problemType;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f97316; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center; }
        .content { background: #ffffff; padding: 32px 24px; border-radius: 0 0 16px 16px; }
        .box { background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 32px; padding: 20px; }
      </style>
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;">
      <div class="container" style="max-width:600px;margin:0 auto;padding:20px;">
        <div class="header" style="background:#f97316;color:white;padding:32px 24px;border-radius:16px 16px 0 0;text-align:center;">
          <h1 style="margin:0;font-size:26px;font-weight:700;">Your Locksmith Job is Ready</h1>
          <p style="margin:12px 0 0 0;opacity:0.9;font-size:15px;">Complete your account to track your locksmith</p>
        </div>
        <div class="content" style="background:#ffffff;padding:32px 24px;border-radius:0 0 16px 16px;">
          <p style="font-size:17px;margin:0 0 24px 0;color:#1e293b;">Hi ${data.customerName},</p>
          <p style="margin:0 0 16px 0;color:#475569;">A locksmith job has been created for you. Complete your account setup to:</p>
          <ul style="color:#475569;margin:0 0 24px 0;padding-left:20px;">
            <li style="margin-bottom:8px;">Track your locksmith's arrival in real-time</li>
            <li style="margin-bottom:8px;">View and approve quotes before work begins</li>
            <li style="margin-bottom:8px;">Pay securely through our platform</li>
            <li style="margin-bottom:0;">Access your complete job documentation</li>
          </ul>

          <div class="box" style="background:#f8fafc;padding:24px;border-radius:12px;margin:24px 0;border:1px solid #e2e8f0;">
            <h3 style="margin:0 0 20px 0;color:#1e293b;font-size:18px;font-weight:600;">Job Details</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;width:120px;vertical-align:top;">Job Number</td>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:600;font-family:monospace;font-size:15px;">${data.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;vertical-align:top;">Issue</td>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:600;font-size:15px;">${problemLabel}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;vertical-align:top;">Location</td>
                <td style="padding:12px 0;color:#1e293b;font-weight:600;font-size:15px;">${data.jobAddress}</td>
              </tr>
            </table>
          </div>

          <div style="text-align:center;margin:32px 0;">
            <a href="${data.onboardingUrl}" style="display:inline-block;background:#f97316;color:#ffffff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">Complete Account Setup</a>
          </div>

          <div class="box" style="background:#fffbeb;padding:24px;border-radius:12px;margin:24px 0;border:1px solid #fcd34d;">
            <h4 style="margin:0 0 20px 0;color:#92400e;font-size:16px;font-weight:600;">What happens next?</h4>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 16px 0;vertical-align:top;width:48px;">
                  <div style="width:32px;height:32px;background:#f97316;color:white;border-radius:50%;text-align:center;line-height:32px;font-weight:bold;font-size:14px;">1</div>
                </td>
                <td style="padding:0 0 16px 0;vertical-align:top;">
                  <p style="margin:0 0 4px 0;font-weight:600;color:#1e293b;font-size:15px;">Set your password</p>
                  <p style="margin:0;color:#64748b;font-size:14px;">Create a secure password for your account</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 0 16px 0;vertical-align:top;width:48px;">
                  <div style="width:32px;height:32px;background:#f97316;color:white;border-radius:50%;text-align:center;line-height:32px;font-weight:bold;font-size:14px;">2</div>
                </td>
                <td style="padding:0 0 16px 0;vertical-align:top;">
                  <p style="margin:0 0 4px 0;font-weight:600;color:#1e293b;font-size:15px;">Confirm your address</p>
                  <p style="margin:0;color:#64748b;font-size:14px;">Verify the job location is correct</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0;vertical-align:top;width:48px;">
                  <div style="width:32px;height:32px;background:#f97316;color:white;border-radius:50%;text-align:center;line-height:32px;font-weight:bold;font-size:14px;">3</div>
                </td>
                <td style="padding:0;vertical-align:top;">
                  <p style="margin:0 0 4px 0;font-weight:600;color:#1e293b;font-size:15px;">Get matched with locksmiths</p>
                  <p style="margin:0;color:#64748b;font-size:14px;">Nearby verified locksmiths will apply for your job</p>
                </td>
              </tr>
            </table>
          </div>

          <p style="color:#64748b;font-size:14px;">This link will expire in 7 days. If you didn't request a locksmith, please ignore this email.</p>

          <p style="color:#94a3b8;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${data.onboardingUrl}" style="color:#f97316;word-break:break-all;">${data.onboardingUrl}</a></p>
        </div>
        <div class="footer">
          <p style="margin:0;">${SITE_NAME} - UK's First Anti-Fraud Locksmith Platform</p>
          <p style="margin:8px 0 0 0;">Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `Complete Your Account - Job ${data.jobNumber} | ${SITE_NAME}`,
    html,
  });
}

/**
 * Send confirmation email after customer completes onboarding
 */
export async function sendOnboardingCompleteEmail(
  customerEmail: string,
  data: {
    customerName: string;
    jobNumber: string;
    jobUrl: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #16a34a; color: white; padding: 32px 24px; border-radius: 16px 16px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 32px 24px; border-radius: 0 0 16px 16px; }
        .box { background: white; padding: 24px; border-radius: 16px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 32px; }
        .button { display: inline-block; background: #f97316; color: white !important; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:48px;margin-bottom:8px;">✓</div>
          <h1 style="margin:0;font-size:28px;">Account Setup Complete!</h1>
          <p style="margin:12px 0 0 0;opacity:0.9;font-size:16px;">Your job is now active</p>
        </div>
        <div class="content">
          <p style="font-size:18px;margin-bottom:24px;">Hi ${data.customerName},</p>
          <p>Great news! Your account has been set up and your job <strong>${data.jobNumber}</strong> is now active.</p>

          <div class="box" style="text-align:center;background:#f0fdf4;border-color:#86efac;">
            <p style="margin:0;color:#16a34a;font-size:18px;font-weight:600;">Locksmiths in your area are being notified</p>
            <p style="margin:8px 0 0 0;color:#166534;">You'll receive applications shortly</p>
          </div>

          <p>What you can do now:</p>
          <ul style="color:#475569;margin:16px 0;">
            <li>View incoming locksmith applications</li>
            <li>Compare prices and reviews</li>
            <li>Select your preferred locksmith</li>
            <li>Track their arrival in real-time</li>
          </ul>

          <div style="text-align:center;margin:32px 0;">
            <a href="${data.jobUrl}" class="button">View Your Job</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin:0;">${SITE_NAME} - UK's First Anti-Fraud Locksmith Platform</p>
          <p style="margin:8px 0 0 0;">Need help? Contact ${SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: customerEmail,
    subject: `You're All Set! Track Job ${data.jobNumber} | ${SITE_NAME}`,
    html,
  });
}
