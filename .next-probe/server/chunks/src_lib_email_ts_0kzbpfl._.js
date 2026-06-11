module.exports=[492749,e=>{"use strict";var t=e.i(246245),o=e.i(798003);async function i(e,t){return n({to:e,subject:"Unlock More Jobs: Complete Your LockSafe Payout Setup",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Complete Your LockSafe Payout Setup</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f7f7f9; color: #222; margin: 0; padding: 0; }
        .container { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 28px; }
        h1 { color: #1a73e8; font-size: 1.7em; margin-bottom: 0.5em; }
        .cta-btn {
          display: inline-block;
          background: #1a73e8;
          color: #fff !important;
          text-decoration: none;
          font-weight: 600;
          padding: 16px 32px;
          border-radius: 6px;
          font-size: 1.1em;
          margin: 24px 0 16px 0;
          box-shadow: 0 2px 6px rgba(26,115,232,0.08);
          transition: background 0.2s;
        }
        .cta-btn:hover { background: #155ab6; }
        ul { margin: 18px 0 18px 18px; }
        li { margin-bottom: 10px; }
        .footer { color: #888; font-size: 0.95em; margin-top: 32px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>You're One Step Away from More Jobs</h1>
        <p>Hi ${t.locksmithName},</p>
        <p>
          You’re almost ready to unlock the full power of LockSafe.<br>
          <strong>Just complete your Stripe payout setup to start receiving leads and payments instantly.</strong>
        </p>
        <ul>
          <li><strong>Get more jobs:</strong> Appear as a verified locksmith and get matched with real customers in your area.</li>
          <li><strong>Get paid fast:</strong> Secure, direct payouts to your bank account — no delays, no hassle.</li>
          <li><strong>Stand out & build trust:</strong> Verified pros win more business and earn higher ratings.</li>
          <li><strong>We bring you customers:</strong> Focus on your work while we handle the marketing and admin.</li>
        </ul>
        <p>
          <strong>Don’t leave money on the table.</strong> It only takes a minute to finish — and you’ll be ready to grow your business with LockSafe.
        </p>
        <p style="text-align:center;">
          <a class="cta-btn" href="${t.stripeOnboardingUrl}" target="_blank">
            Complete Stripe Setup & Get Started
          </a>
        </p>
        <p>
          Questions or need help? Just reply to this email — our team is here for you.
        </p>
        <div class="footer">
          LockSafe UK<br>
          Helping locksmiths grow, one job at a time.
        </div>
      </div>
    </body>
    </html>
  `})}async function r(e,t){let i=`${o.SITE_URL}/locksmith/dashboard`,r=process.env.NEXT_PUBLIC_LOCKSAFE_IOS_APP_URL||i,a=process.env.NEXT_PUBLIC_LOCKSAFE_ANDROID_APP_URL||i,s=process.env.NEXT_PUBLIC_LOCKSAFE_PWA_URL||`${o.SITE_URL}/install`;return n({to:e,subject:"Reminder: install the LockSafe app to receive jobs faster",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Install the LockSafe App</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 0; }
        .container { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; }
        h1 { margin: 0 0 12px 0; color: #ea580c; font-size: 24px; }
        p { margin: 0 0 12px 0; line-height: 1.6; }
        ul { margin: 0 0 16px 18px; }
        li { margin-bottom: 8px; }
        .button {
          display: inline-block;
          margin-top: 8px;
          background: #ea580c;
          color: #fff !important;
          text-decoration: none;
          font-weight: 600;
          padding: 12px 20px;
          border-radius: 8px;
        }
        .channels {
          margin: 14px 0 8px 0;
          padding: 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
        }
        .channel-item {
          margin: 0 0 10px 0;
          line-height: 1.5;
        }
        .channel-item:last-child { margin-bottom: 0; }
        .footer { margin-top: 22px; color: #64748b; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Quick Reminder: install the LockSafe app</h1>
        <p>Hi ${t.locksmithName},</p>
        <p>
          We noticed your account does not currently have an active app installation.
          Installing the app helps you respond faster and win more jobs.
        </p>
        <ul>
          <li>Get instant job alerts on your phone</li>
          <li>Accept and manage jobs without delays</li>
          <li>Stay visible for urgent nearby work</li>
        </ul>
        <div class="channels">
          <p class="channel-item"><strong>iOS app (iPhone):</strong> Install from the App Store, then sign in with your locksmith account.</p>
          <p class="channel-item"><strong>Android app:</strong> Install from Google Play, then sign in with your locksmith account.</p>
          <p class="channel-item"><strong>PWA (web app):</strong> Open the dashboard in your mobile browser and tap <strong>Add to Home Screen</strong> / <strong>Install App</strong>.</p>
        </div>

        <p>Use any of these options:</p>
        <p>
          <a class="button" href="${r}" target="_blank">Open iOS Option</a>
        </p>
        <p>
          <a class="button" href="${a}" target="_blank">Open Android Option</a>
        </p>
        <p>
          <a class="button" href="${s}" target="_blank">Open PWA Option</a>
        </p>
        <p>
          If links open the dashboard instead of a store page, use the install prompt there and we will still register your app channel.
        </p>
        <div class="footer">
          LockSafe UK Operations
        </div>
      </div>
    </body>
    </html>
  `})}let a=function(e,t){let o=function(e){if(!e)return null;let t=e.replace(/\s+/g,"").replace(/[^\d+]/g,"");if(!t)return null;let o=t.startsWith("+")?t.slice(1):t;if(o.startsWith("0"))if(!o.startsWith("07")||11!==o.length)return null;else o=`44${o.slice(1)}`;return/^\d{7,15}$/.test(o)?o:null}(e);if(!o)return null;let i=new URLSearchParams({phone:o});return t&&i.set("text",t),`whatsapp://send?${i.toString()}`}(o.LOCKSMITH_ADMIN_WHATSAPP,"Hi LockSafe admin team, I need support with my locksmith account.")||"#";async function n(e){try{if(!process.env.RESEND_API_KEY)return console.log("Email would be sent:",e),{success:!0,mock:!0};let o=await new t.Resend(process.env.RESEND_API_KEY).emails.send({from:"LockSafe UK <noreply@locksafe.uk>",to:e.to,subject:e.subject,html:e.html,...e.replyTo?{reply_to:e.replyTo}:{}});return{success:!0,id:o.data?.id}}catch(e){return console.error("Failed to send email:",e),{success:!1,error:e instanceof Error?e.message:"Unknown error"}}}async function s(e,t){return n({to:e,subject:"Verify your email - LockSafe UK",html:`
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
          <p>Hi ${t.customerName},</p>
          <p>Thank you for creating an account with LockSafe UK. Please verify your email address to complete your registration.</p>

          <div class="box">
            <p style="margin:0 0 16px 0;color:#64748b;">Click the button below to verify your email:</p>
            <a href="${t.verificationUrl}" class="button">Verify Email Address</a>
          </div>

          <p style="color:#64748b;font-size:14px;">This link will expire in 24 hours. If you didn't create an account with LockSafe, you can safely ignore this email.</p>

          <p style="color:#64748b;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${t.verificationUrl}" style="color:#f97316;word-break:break-all;">${t.verificationUrl}</a></p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
        </div>
      </div>
    </body>
    </html>
  `})}async function d(e,t){return n({to:e,subject:"Reset your password - LockSafe UK",html:`
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
          <p>Hi ${t.customerName},</p>
          <p>We received a request to reset your password for your LockSafe account. Click the button below to create a new password.</p>

          <div class="box">
            <p style="margin:0 0 16px 0;color:#64748b;">Click the button below to reset your password:</p>
            <a href="${t.resetUrl}" class="button">Reset Password</a>
          </div>

          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;">
            <strong>Security notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned about your account security.
          </p>

          <p style="color:#64748b;font-size:12px;margin-top:24px;">If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${t.resetUrl}" style="color:#f97316;word-break:break-all;">${t.resetUrl}</a></p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Need help? Contact ${o.SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `})}async function p(e,t){let i=`${o.SITE_URL}/locksmith/dashboard`,r=`${o.SITE_URL}/locksmith/settings`,a=`${o.SITE_URL}/locksmith/faq`,s=process.env.NEXT_PUBLIC_LOCKSAFE_IOS_APP_URL||i,d=process.env.NEXT_PUBLIC_LOCKSAFE_ANDROID_APP_URL||i,p=process.env.NEXT_PUBLIC_LOCKSAFE_PWA_URL||`${o.SITE_URL}/install`;return n({to:e,subject:"Welcome to LockSafe UK! Get Started as a Partner Locksmith",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f1f5f9; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 40px 24px; border-radius: 16px 16px 0 0; text-align: center; }
        .content { background: #ffffff; padding: 32px 24px; border-radius: 0 0 16px 16px; }
        .box { background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0; }
        .step { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
        .step:last-child { margin-bottom: 0; }
        .step-number { width: 36px; height: 36px; background: #f97316; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
        .step-content { flex: 1; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 32px; padding: 20px; }
        .button { display: inline-block; background: #f97316; color: white !important; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; }
        .button-secondary { display: inline-block; background: white; color: #f97316 !important; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; border: 2px solid #f97316; margin-left: 10px; }
      </style>
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;">
      <div class="container">
        <div class="header">
          <div style="font-size:56px;margin-bottom:12px;">🔐</div>
          <h1 style="margin:0;font-size:32px;font-weight:700;">Welcome to LockSafe UK!</h1>
          <p style="margin:12px 0 0 0;opacity:0.95;font-size:18px;">Your Partner Account is Ready</p>
        </div>
        <div class="content">
          <p style="font-size:18px;margin:0 0 24px 0;">Hi ${t.locksmithName},</p>

          <p style="margin:0 0 20px 0;color:#475569;">
            Thank you for joining LockSafe UK${t.companyName?` with <strong>${t.companyName}</strong>`:""}!
            We're excited to have you as part of our network of trusted locksmith professionals.
          </p>

          <div class="box" style="background:linear-gradient(135deg, #fff7ed, #ffedd5);border-color:#fed7aa;">
            <h3 style="margin:0 0 20px 0;color:#c2410c;font-size:18px;font-weight:700;">Getting Started Checklist</h3>

            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <p style="margin:0;font-weight:600;color:#1e293b;">Complete Your Profile</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Add your services, experience, and upload your photo to build trust with customers.</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <p style="margin:0;font-weight:600;color:#1e293b;">Set Your Assessment Fee</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Configure your default assessment fee to be automatically applied when you accept jobs.</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <p style="margin:0;font-weight:600;color:#1e293b;">Upload Your Insurance Documents</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Upload your public liability insurance to get verified and unlock all features.</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">4</div>
              <div class="step-content">
                <p style="margin:0;font-weight:600;color:#1e293b;">Connect Stripe for Payments</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Set up your Stripe account to receive automatic payouts for completed jobs.</p>
              </div>
            </div>

            <div class="step">
              <div class="step-number">5</div>
              <div class="step-content">
                <p style="margin:0;font-weight:600;color:#1e293b;">Install App Channel (iOS / Android / PWA)</p>
                <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Use any channel below so job alerts reach you instantly.</p>
                <p style="margin:8px 0 0 0;color:#334155;font-size:13px;">
                  <a href="${s}" style="color:#ea580c;font-weight:600;">iOS option</a>
                  &nbsp;|&nbsp;
                  <a href="${d}" style="color:#ea580c;font-weight:600;">Android option</a>
                  &nbsp;|&nbsp;
                  <a href="${p}" style="color:#ea580c;font-weight:600;">PWA option</a>
                </p>
              </div>
            </div>
          </div>

          <div class="box">
            <h3 style="margin:0 0 16px 0;color:#1e293b;font-size:18px;font-weight:600;">How LockSafe Works</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;width:40px;">
                  <span style="font-size:20px;">📱</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">
                  <p style="margin:0;font-weight:600;color:#1e293b;">Get Job Notifications</p>
                  <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Receive instant alerts for jobs in your coverage area via email, SMS, and push notifications.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">
                  <span style="font-size:20px;">✅</span>
                </td>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">
                  <p style="margin:0;font-weight:600;color:#1e293b;">Accept & Complete Jobs</p>
                  <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Apply for jobs, provide quotes, and complete work with GPS verification.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 0;vertical-align:top;">
                  <span style="font-size:20px;">💰</span>
                </td>
                <td style="padding:12px 0;vertical-align:top;">
                  <p style="margin:0;font-weight:600;color:#1e293b;">Get Paid Automatically</p>
                  <p style="margin:4px 0 0 0;color:#64748b;font-size:14px;">Receive secure payments directly to your bank account via Stripe Connect.</p>
                </td>
              </tr>
            </table>
          </div>

          <div class="box" style="background:#f0fdf4;border-color:#86efac;">
            <h3 style="margin:0 0 12px 0;color:#166534;font-size:16px;font-weight:600;">Commission Structure</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#166534;">Assessment Fee Commission:</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;color:#166534;">From 15% (keep up to 85%)</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#166534;border-top:1px solid #bbf7d0;">Work Quote Commission:</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;color:#166534;border-top:1px solid #bbf7d0;">From 25% (keep up to 75%)</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:8px 0;color:#166534;font-size:11px;border-top:1px solid #bbf7d0;">In high-demand areas, jobs may be offered at a higher rate via our live auction — you always confirm before accepting.</td>
              </tr>
            </table>
          </div>

          <div style="text-align:center;margin:32px 0;">
            <a href="${i}" class="button">Go to Dashboard</a>
            <a href="${r}" class="button-secondary">Complete Profile</a>
          </div>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:16px;border-radius:12px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Need Help?</strong> Check out our <a href="${a}" style="color:#1e40af;font-weight:600;">Locksmith FAQ</a> or contact our support team at ${o.SUPPORT_EMAIL}. We're here to help you succeed!
          </p>
        </div>
        <div class="footer">
          <p style="margin:0;">${o.SITE_NAME} - Locksmith Partner Portal</p>
          <p style="margin:8px 0 0 0;">UK's First Anti-Fraud Locksmith Platform</p>
          <p style="margin:16px 0 0 0;font-size:11px;color:#94a3b8;">
            You received this email because you registered as a locksmith partner on LockSafe UK.
          </p>
        </div>
      </div>
    </body>
    </html>
  `})}async function l(e,t){let i=`${o.SITE_URL}/locksmith/dashboard`,r=process.env.NEXT_PUBLIC_LOCKSAFE_IOS_APP_URL||i,a=process.env.NEXT_PUBLIC_LOCKSAFE_ANDROID_APP_URL||i,s=process.env.NEXT_PUBLIC_LOCKSAFE_PWA_URL||`${o.SITE_URL}/install`;return n({to:e,subject:"Complete your app setup: iOS / Android / PWA",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Set Up Your LockSafe App Channel</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 24px; border-radius: 12px 12px 0 0; }
        .content { background: #fff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; }
        .box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px; margin: 16px 0; }
        .cta { display: inline-block; background: #ea580c; color: #fff !important; text-decoration: none; font-weight: 700; padding: 12px 20px; border-radius: 8px; }
        .link { color: #c2410c; font-weight: 700; text-decoration: none; }
        .footer { margin-top: 18px; color: #64748b; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">Welcome back, ${t.locksmithName}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">One quick setup to avoid missing jobs</p>
        </div>
        <div class="content">
          <p>To receive job alerts faster, please set up at least one app channel now:</p>
          <div class="box">
            <p style="margin:0 0 8px 0;"><strong>iOS:</strong> <a class="link" href="${r}" target="_blank">Open iOS option</a></p>
            <p style="margin:0 0 8px 0;"><strong>Android:</strong> <a class="link" href="${a}" target="_blank">Open Android option</a></p>
            <p style="margin:0;"><strong>PWA:</strong> <a class="link" href="${s}" target="_blank">Open PWA option</a> and tap Add to Home Screen / Install App</p>
          </div>
          <p>If these links open your dashboard, use the install prompt there and the system will register your app channel.</p>
          <p style="margin-top:20px;"><a href="${i}" class="cta">Go to Dashboard</a></p>
        </div>
        <div class="footer">LockSafe UK - Locksmith Partner Portal</div>
      </div>
    </body>
    </html>
  `})}async function c(e,t){let i=`
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
          <p>Hi ${t.customerName},</p>
          <p>Great news! Your locksmith is on the way.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">JOB NUMBER</p>
            <p style="margin:4px 0 0 0;font-size:18px;font-weight:bold;">${t.jobNumber}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">YOUR LOCKSMITH</p>
            <p style="margin:4px 0;font-size:18px;font-weight:bold;">${t.locksmithName}</p>
            <p style="margin:0;color:#f97316;font-weight:bold;">ETA: ${t.eta} minutes</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">LOCATION</p>
            <p style="margin:4px 0 0 0;">${t.address}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">ASSESSMENT FEE PAID</p>
            <p style="margin:4px 0 0 0;font-size:24px;font-weight:bold;color:#16a34a;">\xa3${t.assessmentFee}</p>
          </div>

          <p>The locksmith will assess your lock and provide a quote for any work needed. You can accept or decline the quote with no obligation.</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/job/${t.jobId}" class="button">Track Your Job</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Booking Confirmed - ${t.locksmithName} is on the way! (${t.jobNumber})`,html:i})}async function x(e,t){let o=`
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
          <h1 style="margin:0;">Locksmith Assigned!</h1>
        </div>
        <div class="content">
          <p>Hi ${t.customerName},</p>
          <p>Great news! We've found an available locksmith for your job.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">JOB NUMBER</p>
            <p style="margin:4px 0 0 0;font-size:18px;font-weight:bold;">${t.jobNumber}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">YOUR LOCKSMITH</p>
            <p style="margin:4px 0;font-size:18px;font-weight:bold;">${t.locksmithName}</p>
            ${t.locksmithCompany?`<p style="margin:0;color:#64748b;">${t.locksmithCompany}</p>`:""}
            <p style="margin:4px 0 0 0;color:#f97316;font-weight:bold;">ETA: ${t.eta} minutes</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">SERVICE DETAILS</p>
            <p style="margin:4px 0 0 0;"><strong>Problem:</strong> ${t.problemType}</p>
            <p style="margin:4px 0 0 0;"><strong>Location:</strong> ${t.address}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">ASSESSMENT FEE</p>
            <p style="margin:4px 0 0 0;font-size:24px;font-weight:bold;color:#f97316;">\xa3${t.assessmentFee.toFixed(2)}</p>
            <p style="margin:8px 0 0 0;font-size:14px;color:#64748b;">Pay now to confirm your booking</p>
          </div>

          <p><strong>Next Step:</strong> Please pay the assessment fee to confirm your booking. Once paid, the locksmith will be on their way!</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.paymentUrl}" class="button" style="font-size:16px;font-weight:bold;">Pay Assessment Fee</a>
          </p>

          <p style="font-size:14px;color:#64748b;margin-top:20px;">The assessment fee covers the locksmith's visit and diagnosis. They will assess your lock and provide a quote for any work needed. You can accept or decline the quote with no obligation.</p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
          <p>Need help? Contact us: +44 20 4577 1989</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Locksmith Assigned - Please Confirm Booking (${t.jobNumber})`,html:o})}async function g(e,t){let i=`
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
          <p>Hi ${t.customerName},</p>
          <p>${t.locksmithName} has completed the assessment and sent you a quote for the work.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">DIAGNOSIS</p>
            <p style="margin:4px 0 0 0;">${t.diagnosis}</p>
          </div>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">QUOTE TOTAL</p>
            <p style="margin:4px 0 0 0;font-size:36px;font-weight:bold;color:#f97316;">\xa3${t.quoteTotal}</p>
            <p style="margin:8px 0 0 0;color:#64748b;">Estimated time: ${t.estimatedTime} minutes</p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/job/${t.jobId}/quote" class="button">View Full Quote</a>
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
  `;return n({to:e,subject:`Quote Received: \xa3${t.quoteTotal} - Review and Respond (${t.jobNumber})`,html:i})}async function b(e,t){let i=`
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
          <p>Hi ${t.customerName},</p>
          <p>A locksmith has applied for your job and is ready to help.</p>

          <div class="box">
            <p style="margin:0;font-size:20px;font-weight:bold;">${t.locksmithName}</p>
            <p style="margin:4px 0;">Rating: ${"★".repeat(Math.round(t.rating))} ${t.rating}/5</p>
            <p style="margin:4px 0;color:#f97316;font-weight:bold;">Assessment Fee: \xa3${t.assessmentFee}</p>
            <p style="margin:4px 0;color:#64748b;">Can arrive in: ${t.eta} minutes</p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/job/${t.jobId}" class="button">View All Applications</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`${t.locksmithName} can help! ETA: ${t.eta} min (${t.jobNumber})`,html:i})}async function f(e,t){let i=`
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
          <p>Hi ${t.customerName},</p>
          <p>Your locksmith job has been completed successfully.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:12px;">TOTAL PAID</p>
            <p style="margin:4px 0 0 0;font-size:36px;font-weight:bold;color:#16a34a;">\xa3${t.totalPaid}</p>
          </div>

          <p>Your legal PDF report is ready. This document contains:</p>
          <ul>
            <li>Complete job timeline with GPS verification</li>
            <li>Before/after photos</li>
            <li>Itemized invoice</li>
            <li>Your digital signature</li>
          </ul>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.reportUrl}" class="button">Download PDF Report</a>
          </p>

          <p style="text-align:center;margin-top:16px;">
            <a href="${o.SITE_URL}/customer/job/${t.jobId}/review" style="color:#f97316;">Rate your experience with ${t.locksmithName}</a>
          </p>
        </div>
        <div class="footer">
          <p>Thank you for using LockSafe UK!</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Job Complete! Download your report (${t.jobNumber})`,html:i})}async function m(e,t){let i=`
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
          <p>Hi ${t.locksmithName},</p>
          <p>Great news! Your payout has been processed and is on its way to your bank account.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Amount Transferred</p>
            <p class="amount" style="margin:8px 0 0 0;">\xa3${t.amount.toFixed(2)}</p>
          </div>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Bank Account</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;">•••• ${t.bankLast4}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Expected Arrival</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.arrivalDate}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Reference</td>
                <td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px;border-top:1px solid #e2e8f0;">${t.payoutId.slice(0,20)}...</td>
              </tr>
            </table>
          </div>

          <p style="background:#ecfdf5;border:1px solid #bbf7d0;padding:12px 16px;border-radius:8px;color:#166534;font-size:14px;">
            <strong>Note:</strong> Bank transfers typically arrive within 1-2 business days, depending on your bank.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/locksmith/earnings" class="button">View Earnings Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Payout Sent: \xa3${t.amount.toFixed(2)} on its way!`,html:i})}async function u(e,t){let i=`
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
          <p>Hi ${t.locksmithName},</p>
          <p>Unfortunately, we were unable to process your payout of <strong>\xa3${t.amount.toFixed(2)}</strong>.</p>

          <div class="box" style="background:#fef2f2;border:1px solid #fecaca;">
            <p style="margin:0;color:#991b1b;font-weight:600;">Reason for failure:</p>
            <p style="margin:8px 0 0 0;color:#dc2626;">${t.failureReason}</p>
            <p style="margin:8px 0 0 0;font-size:12px;color:#9ca3af;">Error code: ${t.failureCode}</p>
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
            <a href="mailto:${o.SUPPORT_EMAIL}" class="button-secondary">Contact Support</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Action Required: Payout of \xa3${t.amount.toFixed(2)} failed`,html:i})}async function h(e,t){let i=`
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
        .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;">New Job Assignment!</h1>
        </div>
        <div class="content">
          <p>Hi ${t.locksmithName},</p>
          <p>You've been assigned a new job by our admin team. Please review the details below and accept or decline.</p>

          <div class="alert">
            <p style="margin:0;font-weight:bold;">⚠️ Action Required</p>
            <p style="margin:4px 0 0 0;">Please respond within 15 minutes to accept or decline this assignment.</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">JOB NUMBER</p>
            <p style="margin:4px 0 0 0;font-size:18px;font-weight:bold;">${t.jobNumber}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">CUSTOMER</p>
            <p style="margin:4px 0 0 0;font-size:16px;">${t.customerName}</p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;">SERVICE DETAILS</p>
            <p style="margin:4px 0 0 0;"><strong>Problem:</strong> ${t.problemType}</p>
            <p style="margin:4px 0 0 0;"><strong>Property:</strong> ${t.propertyType}</p>
            <p style="margin:4px 0 0 0;"><strong>Location:</strong> ${t.address}, ${t.postcode}</p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.jobDetailsUrl}" class="button" style="font-size:16px;font-weight:bold;">View Job & Respond</a>
          </p>

          <p style="font-size:14px;color:#64748b;margin-top:20px;"><strong>What happens next?</strong></p>
          <ul style="font-size:14px;color:#64748b;">
            <li>If you accept: Customer will be notified and sent a payment link</li>
            <li>Once customer pays: You'll receive full job details and can start the work</li>
            <li>If you decline: Admin will reassign the job to another locksmith</li>
          </ul>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`🔔 New Job Assignment - Action Required (${t.jobNumber})`,html:i})}async function y(e,t){let i=`${o.SITE_URL}/locksmith/dashboard`,r=process.env.NEXT_PUBLIC_LOCKSAFE_IOS_APP_URL||i,s=process.env.NEXT_PUBLIC_LOCKSAFE_ANDROID_APP_URL||i,d=process.env.NEXT_PUBLIC_LOCKSAFE_PWA_URL||`${o.SITE_URL}/install`;return n({to:e,subject:"Account Verified - You're ready to receive payouts!",html:`
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
          <p>Hi ${t.locksmithName},</p>
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

          <div class="box" style="background:#fff7ed;border:1px solid #fed7aa;">
            <p style="margin:0 0 8px 0;color:#9a3412;font-size:12px;font-weight:700;">RECOMMENDED: INSTALL AN APP CHANNEL</p>
            <p style="margin:0 0 10px 0;color:#7c2d12;">To avoid missing urgent jobs, install one of these now:</p>
            <p style="margin:0;color:#7c2d12;line-height:1.8;">
              <a href="${r}" style="color:#c2410c;font-weight:700;">iOS option</a>
              &nbsp;|&nbsp;
              <a href="${s}" style="color:#c2410c;font-weight:700;">Android option</a>
              &nbsp;|&nbsp;
              <a href="${d}" style="color:#c2410c;font-weight:700;">PWA option</a>
            </p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${i}" class="button">Start Taking Jobs</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `})}async function v(e,t){let i=`
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
                <td style="padding:8px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Problem</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.problemType}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Assessment Fee</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;color:#16a34a;font-size:18px;border-top:1px solid #e2e8f0;">\xa3${t.assessmentFee}</td>
              </tr>
            </table>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Customer</p>
            <p style="margin:8px 0;font-size:18px;font-weight:bold;">${t.customerName}</p>
            <p style="margin:0;">
              <a href="tel:${t.customerPhone}" style="color:#f97316;font-weight:600;font-size:16px;">${t.customerPhone}</a>
            </p>
          </div>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Location</p>
            <p style="margin:8px 0;font-weight:600;">${t.address}</p>
            <p style="margin:0;color:#475569;">${t.postcode}</p>
            <p style="margin:12px 0 0 0;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(t.address+", "+t.postcode)}" style="color:#f97316;font-weight:600;">📍 Open in Google Maps</a>
            </p>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/locksmith/job/${t.jobId}/work" class="button">View Job Details</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Remember:</strong> Confirm your arrival using GPS when you get to the location. This protects both you and the customer.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`🔔 NEW BOOKING: ${t.problemType} at ${t.postcode} - \xa3${t.assessmentFee} (${t.jobNumber})`,html:i})}async function k(e,t){let o=`
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
                <td style="padding:8px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Locksmith</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.locksmithName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;">${t.address}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Amount Due</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">\xa3${t.quoteTotal.toFixed(2)}</td>
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
            <a href="${t.confirmationUrl}" class="button">Confirm & Sign</a>
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
  `;return n({to:e,subject:`Action Required: Confirm work completion - ${t.jobNumber}`,html:o})}async function w(e,t){let i=Math.round(100*(void 0!==t.commissionRate?t.commissionRate:"work_quote"===t.paymentType?.25:.15)),r=t.totalCharged||t.amount+t.platformFee,s="work_quote"===t.paymentType?"Work Payment":"Assessment Fee",d=`
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
          <p style="margin:8px 0 0 0;opacity:0.9;">${s} for Job ${t.jobNumber}</p>
        </div>
        <div class="content">
          <p>Hi ${t.locksmithName},</p>
          <p>Great news! You've received a ${s.toLowerCase()} for job <strong>${t.jobNumber}</strong>.</p>

          <div class="box" style="text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;">
            <p style="margin:0;color:#64748b;font-size:14px;">YOUR EARNINGS</p>
            <p class="earnings" style="margin:8px 0 0 0;">\xa3${t.amount.toFixed(2)}</p>
            <p style="margin:8px 0 0 0;color:#16a34a;font-weight:500;">Added to your balance</p>
          </div>

          <div class="box">
            <p style="margin:0 0 16px 0;font-weight:600;color:#1e293b;">Payment Breakdown</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Customer Paid</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;">\xa3${r.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Platform Commission (${i}%)</td>
                <td style="padding:12px 0;text-align:right;color:#f97316;">-\xa3${t.platformFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0 0;font-weight:700;font-size:16px;color:#16a34a;">Your Earnings (${100-i}%)</td>
                <td style="padding:16px 0 0 0;text-align:right;font-weight:700;font-size:18px;color:#16a34a;">\xa3${t.amount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Customer</td>
                <td style="padding:10px 0;text-align:right;font-weight:600;">${t.customerName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Job Number</td>
                <td style="padding:10px 0;text-align:right;font-family:monospace;font-weight:600;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#64748b;">Payment Type</td>
                <td style="padding:10px 0;text-align:right;">${s}</td>
              </tr>
            </table>
          </div>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;">
            This amount has been added to your available balance and will be included in your next payout.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/locksmith/earnings" style="display:inline-block;background:#f97316;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Your Earnings</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Payment Received: \xa3${t.amount.toFixed(2)} for ${t.jobNumber}`,html:d})}async function $(e,t){let i="assessment_fee"===t.paymentType?"Assessment Fee":"Work Payment",r=t.paymentDate.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}),a=`
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
          <p style="margin:8px 0 0 0;opacity:0.9;">${i}</p>
        </div>
        <div class="content">
          <p>Hi ${t.customerName},</p>
          <p>Thank you for your payment. Here's your receipt for job <strong>${t.jobNumber}</strong>.</p>

          <div class="box" style="text-align:center;background:#f0fdf4;border-color:#bbf7d0;">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;">AMOUNT PAID</p>
            <p style="margin:8px 0 0 0;font-size:42px;font-weight:bold;color:#16a34a;">\xa3${t.amountPaid.toFixed(2)}</p>
            <p style="margin:8px 0 0 0;color:#64748b;font-size:14px;">${r}</p>
          </div>

          ${"work_quote"===t.paymentType&&t.assessmentFeeDeducted>0?`
          <div class="box">
            <p style="margin:0 0 16px 0;font-weight:600;color:#1e293b;">Payment Breakdown</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#64748b;">Work Quote Total</td>
                <td style="padding:12px 0;text-align:right;font-weight:500;">\xa3${t.quoteTotal.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 0;color:#16a34a;">Assessment Fee Applied</td>
                <td style="padding:12px 0;text-align:right;font-weight:500;color:#16a34a;">-\xa3${t.assessmentFeeDeducted.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:16px 0 0 0;font-weight:700;font-size:18px;">Amount Charged</td>
                <td style="padding:16px 0 0 0;text-align:right;font-weight:700;font-size:18px;color:#f97316;">\xa3${t.amountPaid.toFixed(2)}</td>
              </tr>
            </table>
          </div>
          `:""}

          <div class="box">
            <p style="margin:0 0 12px 0;font-weight:600;color:#1e293b;">Job Details</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Job Number</td>
                <td style="padding:10px 0;text-align:right;font-family:monospace;font-weight:600;">${t.jobNumber}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Locksmith</td>
                <td style="padding:10px 0;text-align:right;">${t.locksmithName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;color:#64748b;">Location</td>
                <td style="padding:10px 0;text-align:right;">${t.address}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#64748b;">Payment Type</td>
                <td style="padding:10px 0;text-align:right;">${i}</td>
              </tr>
            </table>
          </div>

          <p style="color:#64748b;font-size:14px;text-align:center;">
            A copy of this receipt has been saved to your account.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/job/${t.jobId}" style="display:inline-block;background:#f97316;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">View Job Details</a>
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
  `;return n({to:e,subject:`Payment Receipt: \xa3${t.amountPaid.toFixed(2)} - ${t.jobNumber}`,html:a})}async function z(e,t){let i=`
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

          <p>Hi ${t.locksmithName},</p>
          <p>Great news! ${t.customerName} has approved your quote and you're now cleared to proceed with the work.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Job Details</p>
            <table style="width:100%;margin-top:12px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Customer</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.customerName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;">${t.address}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Quote Total</td>
                <td style="padding:8px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">\xa3${t.quoteTotal.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/locksmith/job/${t.jobId}/work" class="button">Start Work</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Reminder:</strong> When work is complete, mark the job as finished in the app. The customer will then sign to confirm and payment will be processed automatically.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Quote Accepted! Start work on ${t.jobNumber}`,html:i})}async function S(e,t){let i=`
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
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${t.jobNumber}</p>
        </div>
        <div class="content">
          <p>Hi ${t.locksmithName},</p>
          <p>${t.customerName} has decided not to proceed with the work at this time. The assessment fee has already been paid for your time.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Job Summary</p>
            <table style="width:100%;margin-top:12px;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:8px 0;text-align:right;border-top:1px solid #e2e8f0;">${t.address}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Quote Amount</td>
                <td style="padding:8px 0;text-align:right;text-decoration:line-through;color:#94a3b8;border-top:1px solid #e2e8f0;">\xa3${t.quoteTotal.toFixed(2)}</td>
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
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Quote Declined - ${t.jobNumber}`,html:i})}async function E(e,t){let i="★".repeat(t.rating)+"☆".repeat(5-t.rating),r=t.rating>=4?"#16a34a":t.rating>=3?"#f97316":"#dc2626",s=`
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
        .stars { font-size: 32px; color: ${r}; letter-spacing: 2px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">New Review Received!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">From ${t.customerName}</p>
        </div>
        <div class="content">
          <p>Hi ${t.locksmithName},</p>
          <p>${t.customerName} left a review for job ${t.jobNumber}.</p>

          <div class="box" style="text-align:center;">
            <p class="stars">${i}</p>
            <p style="margin:8px 0 0 0;font-size:24px;font-weight:bold;color:${r};">${t.rating}/5 Stars</p>
          </div>

          ${t.comment?`
          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Customer Review</p>
            <p style="margin:12px 0 0 0;font-style:italic;color:#475569;">"${t.comment}"</p>
          </div>
          `:""}

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/locksmith/reviews" class="button">View All Reviews</a>
          </p>

          <p style="color:#64748b;font-size:14px;text-align:center;margin-top:16px;">
            Great reviews help you get more jobs. Keep up the excellent work!
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`New ${t.rating}-Star Review from ${t.customerName}`,html:s})}async function L(e,t){let i=`
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
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${t.jobNumber}</p>
        </div>
        <div class="content">
          <div class="arrived">
            <p style="margin:0;font-size:40px;">📍</p>
            <p style="margin:8px 0 0 0;font-size:18px;color:#16a34a;font-weight:bold;">${t.locksmithName} has arrived at your location</p>
          </div>

          <p>Hi ${t.customerName},</p>
          <p>Your locksmith has arrived and checked in at ${t.address}. They will now assess the issue and provide you with a quote.</p>

          <div class="box">
            <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Locksmith</p>
            <p style="margin:8px 0;font-size:18px;font-weight:bold;">${t.locksmithName}</p>
            <p style="margin:0;">
              <a href="tel:${t.locksmithPhone}" style="color:#f97316;font-weight:600;font-size:16px;">${t.locksmithPhone}</a>
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
            <a href="${o.SITE_URL}/customer/job/${t.jobId}" class="button">Track Your Job</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`${t.locksmithName} has arrived! - ${t.jobNumber}`,html:i})}async function A(e,t){let i={lockout:"Locked Out",broken:"Broken Lock","key-stuck":"Key Stuck","lost-keys":"Lost Keys",burglary:"After Burglary",other:"Other Issue"}[t.problemType]||t.problemType,r=t.propertyType?({house:"House",flat:"Flat/Apartment",commercial:"Commercial",car:"Vehicle"})[t.propertyType]||t.propertyType:"Property",a=`
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
          <h1 style="margin:8px 0 0 0;font-size:28px;">${i}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">${t.postcode} • <span class="distance">${t.distanceMiles} miles away</span></p>
        </div>
        <div class="content">
          <div class="urgent">
            <p style="margin:0;color:#dc2626;font-weight:600;">⚡ Customer waiting for a locksmith!</p>
          </div>

          <p>Hi ${t.locksmithName},</p>
          <p>A new job has just been posted in your coverage area. Be one of the first to apply!</p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;">Job Reference</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Problem Type</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${i}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Property</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${r}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.postcode}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Distance</td>
                <td style="padding:12px 0;text-align:right;border-top:1px solid #e2e8f0;">
                  <span style="background:#dcfce7;color:#166534;padding:4px 10px;border-radius:20px;font-weight:600;font-size:14px;">${t.distanceMiles} miles</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;">
            <strong>Quick Tip:</strong> Jobs with faster response times and competitive assessment fees tend to get accepted more often!
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.jobId?`${o.SITE_URL}/locksmith/job/${t.jobId}`:`${o.SITE_URL}/locksmith/jobs`}" class="button">View & Apply Now →</a>
          </p>

          <p style="text-align:center;color:#64748b;font-size:12px;margin-top:16px;">
            Apply quickly before other locksmiths do!
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Portal</p>
          <p style="margin-top:8px;">
            <a href="${o.SITE_URL}/locksmith/settings" style="color:#f97316;text-decoration:none;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`🔔 New Job: ${i} in ${t.postcode} (${t.distanceMiles} mi)`,html:a})}async function N(e,t){let i={lockout:"Locked Out",broken:"Broken Lock","key-stuck":"Key Stuck","lost-keys":"Lost Keys",burglary:"After Burglary",other:"Other Issue"}[t.problemType]||t.problemType,r=`
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
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">${t.postcode} • ${i}</p>
        </div>
        <div class="content">
          <div class="auto-dispatch-badge">
            <p style="margin:0;color:#166534;font-weight:600;">✨ You've been auto-matched to this job based on your location and rating!</p>
          </div>

          <p>Hi ${t.locksmithName},</p>
          <p>Our intelligent matching system has assigned you to a new job. The customer is waiting for you!</p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;">Job Reference</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Customer</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.customerName}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Problem</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${i}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Location</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.address}<br><span style="color:#64748b;">${t.postcode}</span></td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;border-top:1px solid #e2e8f0;">Assessment Fee</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">
                  <span style="background:#dcfce7;color:#166534;padding:4px 12px;border-radius:20px;">\xa3${t.assessmentFee.toFixed(2)}</span>
                </td>
              </tr>
            </table>
          </div>

          <p style="background:#fef3c7;border:1px solid #fde68a;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;">
            <strong>Action Required:</strong> Please accept this job and head to the customer as soon as possible. Mark yourself as "En Route" when you leave.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/locksmith/job/${t.jobId}" class="button">View Job Details →</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Intelligent Dispatch System</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`🎯 AUTO-DISPATCH: Job ${t.jobNumber} assigned to you!`,html:r})}async function P(e,t){let i=t.reminderNumber>=3,r=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { ${i?"background: linear-gradient(135deg, #dc2626, #b91c1c);":"background: linear-gradient(135deg, #f97316, #ea580c);"} color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #16a34a; color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px; }
        .urgent { background: #fef2f2; border: 2px solid #fecaca; padding: 16px; border-radius: 12px; text-align: center; }
        .timer { font-size: 28px; font-weight: bold; color: ${i?"#dc2626":"#f97316"}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">${i?"⚠️ Urgent: Signature Required":"Reminder: Please Sign Off"}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${t.jobNumber}</p>
        </div>
        <div class="content">
          ${i?`
          <div class="urgent">
            <p class="timer">⏰ ${t.timeRemaining} remaining</p>
            <p style="margin:8px 0 0 0;color:#991b1b;font-weight:500;">Your job will be auto-completed if not signed</p>
          </div>
          `:`
          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;">Time Remaining</p>
            <p class="timer">${t.timeRemaining}</p>
          </div>
          `}

          <p>Hi ${t.customerName},</p>
          <p>${t.locksmithName} has completed the work on your job and is waiting for your confirmation.</p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Job Number</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Locksmith</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.locksmithName}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Amount Due</td>
                <td style="padding:12px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">\xa3${t.totalAmount.toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="box" style="background:#fef3c7;border:1px solid #fcd34d;">
            <p style="margin:0;color:#92400e;font-weight:600;">Why is this important?</p>
            <ul style="margin:12px 0 0 0;color:#78350f;padding-left:20px;">
              <li>Your signature confirms the work is complete</li>
              <li>Payment will be processed securely</li>
              <li>You'll receive a legal PDF report</li>
              ${i?"<li><strong>Auto-completion happens after 24 hours</strong></li>":""}
            </ul>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.confirmUrl}" class="button">Confirm & Sign Now →</a>
          </p>

          <p style="text-align:center;color:#64748b;font-size:14px;margin-top:16px;">
            If you have any issues with the work, please contact the locksmith directly.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Need help? Contact ${o.SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `,a=i?"⚠️ URGENT":`Reminder ${t.reminderNumber}`;return n({to:e,subject:`${a}: Please sign off job ${t.jobNumber} - ${t.timeRemaining} remaining`,html:r})}async function T(e,t){let i=`
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
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Job ${t.jobNumber}</p>
        </div>
        <div class="content">
          <div class="notice">
            <p style="margin:0;color:#92400e;font-weight:600;">⏰ Your job was automatically completed</p>
            <p style="margin:8px 0 0 0;color:#78350f;font-size:14px;">
              The 24-hour confirmation period has expired without a response.
            </p>
          </div>

          <p>Hi ${t.customerName},</p>
          <p>
            Since we didn't receive your signature within 24 hours of ${t.locksmithName} completing the work,
            your job has been automatically completed and payment has been processed.
          </p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Job Number</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;font-family:monospace;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Locksmith</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.locksmithName}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Amount Charged</td>
                <td style="padding:12px 0;text-align:right;font-weight:700;font-size:20px;color:#16a34a;border-top:1px solid #e2e8f0;">\xa3${t.totalAmount.toFixed(2)}</td>
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
            <a href="${t.reportUrl}" class="button">View Job Details</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Have concerns?</strong> If you're not satisfied with the work, please contact our support team at ${o.SUPPORT_EMAIL} within 48 hours.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>Anti-fraud protected with GPS tracking and digital documentation</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Job ${t.jobNumber} Auto-Completed - Payment Processed`,html:i})}async function U(e,t){let i=`${o.SITE_URL}/job/${t.jobId}/report`,r=`${o.SITE_URL}/locksmith/earnings`,s=`
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
          <p>Hi ${t.locksmithName},</p>
          <p>We're writing to inform you that a refund has been processed for job <strong>${t.jobNumber}</strong>, and your earnings have been adjusted accordingly.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;">Amount Reversed</p>
            <p class="amount" style="margin:8px 0;">-\xa3${t.reversedAmount.toFixed(2)}</p>
            <p style="margin:0;color:#64748b;font-size:12px;">This has been deducted from your balance</p>
          </div>

          <div class="alert-box">
            <p style="margin:0;font-weight:600;color:#991b1b;">Reason for refund:</p>
            <p style="margin:8px 0 0 0;color:#dc2626;">${t.reason}</p>
          </div>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;">Job Number</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Customer</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.customerName}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Original Payment</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">\xa3${t.originalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Your Share Reversed</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;color:#dc2626;border-top:1px solid #e2e8f0;">-\xa3${t.reversedAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;border-top:1px solid #e2e8f0;">Refund Date</td>
                <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.refundDate.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
              </tr>
            </table>
          </div>

          <p style="color:#64748b;font-size:14px;">
            This reversal has been automatically processed through Stripe Connect. The amount has been deducted from your connected account balance.
          </p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${r}" class="button">View Your Earnings</a>
            <a href="${i}" class="button-secondary">View Job Details</a>
          </p>

          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;margin-top:24px;">
            <strong>Questions?</strong> If you believe this refund was made in error, please contact our support team at ${o.SUPPORT_EMAIL} within 48 hours with the job number.
          </p>
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} - Locksmith Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Earnings Reversed: -\xa3${t.reversedAmount.toFixed(2)} for Job ${t.jobNumber}`,html:s})}async function C(e,t){let i=`
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

          <p>Hi ${t.customerName},</p>
          <p>Thank you for calling LockSafe UK. We've registered your emergency locksmith request.</p>

          <div class="box" style="text-align:center;">
            <p style="margin:0;color:#64748b;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Reference Number</p>
            <p class="reference" style="margin:8px 0 0 0;">${t.jobNumber}</p>
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
            <a href="${t.continueUrl}" class="button">Complete Your Request</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>What happens next?</strong> Once you submit your request, local verified locksmiths will see your job and send you quotes with their assessment fee and ETA. You choose the best one for you.
          </p>

          <p style="text-align:center;color:#64748b;font-size:12px;margin-top:16px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${t.continueUrl}" style="color:#f97316;word-break:break-all;">${t.continueUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Emergency Locksmith Service</p>
          <p>24/7 Emergency Service | Anti-fraud protected</p>
          <p style="margin-top:8px;">Need help? Contact ${o.SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Complete Your Emergency Request - ${t.jobNumber}`,html:i})}async function j(e,t){let i=`${o.SITE_URL}/locksmith/dashboard`;return n({to:e,subject:`🎉 Congratulations! Your LockSafe Account is Now Verified`,html:`
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
          <p style="font-size:18px;">Hi ${t.locksmithName},</p>

          <p>Great news! Your LockSafe UK account${t.companyName?` for <strong>${t.companyName}</strong>`:""} has been reviewed and <strong style="color:#16a34a;">verified by our team</strong>.</p>

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
            <a href="${i}" class="button">Go to Your Dashboard</a>
          </p>

          <p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;margin-top:24px;">
            <strong>Tip:</strong> Make sure your profile is complete and your coverage area is set correctly to receive the most relevant job notifications.
          </p>
        </div>
        <div class="footer">
          <p>LockSafe UK - Locksmith Partner Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `})}async function I(e,t){let i=t.daysUntilExpiry<=7,r=t.daysUntilExpiry<=0?"has expired":1===t.daysUntilExpiry?"expires tomorrow":`expires in ${t.daysUntilExpiry} days`,s=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { ${i?"background: linear-gradient(135deg, #dc2626, #b91c1c);":"background: linear-gradient(135deg, #f97316, #ea580c);"} color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .alert { background: ${i?"#fef2f2":"#fef3c7"}; border: 2px solid ${i?"#fecaca":"#fcd34d"}; padding: 16px; border-radius: 12px; text-align: center; }
        .countdown { font-size: 48px; font-weight: bold; color: ${i?"#dc2626":"#f97316"}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">⚠️ Insurance ${t.daysUntilExpiry<=0?"Expired":"Expiring Soon"}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Action required for your LockSafe account</p>
        </div>
        <div class="content">
          <div class="alert">
            <p class="countdown">${t.daysUntilExpiry<=0?"EXPIRED":t.daysUntilExpiry}</p>
            <p style="margin:0;color:${i?"#991b1b":"#92400e"};font-weight:600;">
              ${t.daysUntilExpiry<=0?"Your insurance has expired":`day${1===t.daysUntilExpiry?"":"s"} until expiry`}
            </p>
          </div>

          <p>Hi ${t.locksmithName},</p>
          <p>
            Your public liability insurance certificate ${r}.
            ${t.daysUntilExpiry<=0?"Your account has been restricted until you upload a valid insurance document.":"Please renew your insurance and upload the new certificate to continue accepting jobs without interruption."}
          </p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Current Expiry Date</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;${i?"color:#dc2626;":""}">${t.expiryDate.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</td>
              </tr>
              ${t.companyName?`
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Company</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.companyName}</td>
              </tr>
              `:""}
            </table>
          </div>

          <div class="box" style="background:${i?"#fef2f2":"#f0fdf4"};border:1px solid ${i?"#fecaca":"#bbf7d0"};">
            <p style="margin:0;color:${i?"#991b1b":"#166534"};font-weight:600;">
              ${i?"⚠️ Urgent Action Required":"✓ What to do next"}
            </p>
            <ol style="margin:12px 0 0 0;color:${i?"#dc2626":"#15803d"};padding-left:20px;">
              <li>Renew your insurance with your provider</li>
              <li>Log in to your LockSafe account</li>
              <li>Go to Settings → Insurance & Documentation</li>
              <li>Upload your new insurance certificate</li>
              <li>Enter the new expiry date</li>
            </ol>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.renewUrl}" class="button">Update Insurance Now</a>
          </p>

          ${t.daysUntilExpiry<=0?`
          <p style="background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;color:#991b1b;font-size:14px;margin-top:24px;">
            <strong>Important:</strong> Your ability to accept new jobs has been suspended until valid insurance is provided.
            Upload your renewed insurance certificate to restore your account.
          </p>
          `:t.daysUntilExpiry<=7?`
          <p style="background:#fef3c7;border:1px solid #fcd34d;padding:12px 16px;border-radius:8px;color:#92400e;font-size:14px;margin-top:24px;">
            <strong>Note:</strong> If your insurance expires before you renew, your ability to accept new jobs will be temporarily suspended.
          </p>
          `:""}
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} - Locksmith Partner Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#f97316;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `,d=t.daysUntilExpiry<=0?"Insurance Expired - Action Required":`Insurance ${r}`;return n({to:e,subject:`${i?"🚨 URGENT":"⚠️ Reminder"}: ${d}`,html:s})}async function R(e,t){let i={lockout:"Locked Out",broken:"Broken Lock","key-stuck":"Key Stuck","lost-keys":"Lost Keys",burglary:"After Burglary",other:"Other Issue"}[t.problemType]||t.problemType,r=`
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
          <p style="font-size:17px;margin:0 0 24px 0;color:#1e293b;">Hi ${t.customerName},</p>
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
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:600;font-family:monospace;font-size:15px;">${t.jobNumber}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:14px;vertical-align:top;">Issue</td>
                <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#1e293b;font-weight:600;font-size:15px;">${i}</td>
              </tr>
              <tr>
                <td style="padding:12px 0;color:#64748b;font-size:14px;vertical-align:top;">Location</td>
                <td style="padding:12px 0;color:#1e293b;font-weight:600;font-size:15px;">${t.jobAddress}</td>
              </tr>
            </table>
          </div>

          <div style="text-align:center;margin:32px 0;">
            <a href="${t.onboardingUrl}" style="display:inline-block;background:#f97316;color:#ffffff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">Complete Account Setup</a>
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
          <a href="${t.onboardingUrl}" style="color:#f97316;word-break:break-all;">${t.onboardingUrl}</a></p>
        </div>
        <div class="footer">
          <p style="margin:0;">${o.SITE_NAME} - UK's First Anti-Fraud Locksmith Platform</p>
          <p style="margin:8px 0 0 0;">Need help? Contact ${o.SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Complete Your Account - Job ${t.jobNumber} | ${o.SITE_NAME}`,html:r})}async function _(e,t){let i=`
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
          <p style="font-size:18px;margin-bottom:24px;">Hi ${t.customerName},</p>
          <p>Great news! Your account has been set up and your job <strong>${t.jobNumber}</strong> is now active.</p>

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
            <a href="${t.jobUrl}" class="button">View Your Job</a>
          </div>
        </div>
        <div class="footer">
          <p style="margin:0;">${o.SITE_NAME} - UK's First Anti-Fraud Locksmith Platform</p>
          <p style="margin:8px 0 0 0;">Need help? Contact ${o.SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`You're All Set! Track Job ${t.jobNumber} | ${o.SITE_NAME}`,html:i})}async function O(e,t){let i=`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; line-height: 1.6; color: #1e293b; background: #f1f5f9; margin: 0; }
        .container { max-width: 620px; margin: 0 auto; padding: 24px; }
        .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 36px 28px; border-radius: 16px 16px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; line-height: 1.25; }
        .header p { margin: 12px 0 0 0; opacity: 0.95; font-size: 15px; }
        .content { background: #ffffff; padding: 32px 28px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 16px rgba(15,23,42,0.06); }
        .lede { font-size: 17px; color: #0f172a; margin: 0 0 18px 0; }
        .box { background: #fff7ed; border: 1px solid #fed7aa; padding: 20px; border-radius: 14px; margin: 22px 0; }
        .box-title { font-weight: 700; color: #9a3412; margin: 0 0 8px 0; font-size: 15px; letter-spacing: 0.02em; text-transform: uppercase; }
        .checklist { padding: 0; margin: 14px 0 0 0; list-style: none; }
        .checklist li { padding: 6px 0 6px 28px; position: relative; color: #334155; font-size: 15px; }
        .checklist li::before { content: "✓"; position: absolute; left: 0; top: 6px; width: 20px; height: 20px; background: #16a34a; color: white; border-radius: 50%; text-align: center; font-size: 12px; font-weight: 700; line-height: 20px; }
        .cta-wrap { text-align: center; margin: 30px 0 18px 0; }
        .cta { display: inline-block; background: #f97316; color: #ffffff !important; padding: 16px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 17px; box-shadow: 0 4px 12px rgba(249,115,22,0.35); }
        .cta-sub { display: block; margin-top: 10px; color: #64748b; font-size: 13px; }
        .secondary { display: block; margin-top: 18px; color: #f97316; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center; }
        .guarantee { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px 18px; border-radius: 12px; margin: 26px 0 8px 0; color: #065f46; font-size: 14px; line-height: 1.55; }
        .signoff { color: #475569; font-size: 14px; margin: 22px 0 0 0; }
        .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; padding: 0 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>An honest update on job ${t.jobNumber}</h1>
          <p>We'd rather tell you straight than leave you waiting</p>
        </div>
        <div class="content">
          <p class="lede">Hi ${t.customerName},</p>
          <p>Right now we don't have a verified LockSafe UK locksmith available in <strong>${t.postcode}</strong>${t.problemType?` for your ${t.problemType.replace(/-/g," ")} request`:""}. I know that's the last thing you want to hear — so here's exactly what we're going to do about it.</p>

          <div class="box">
            <p class="box-title">Your fastest path to help</p>
            <ul class="checklist">
              <li>Call our <strong>priority dispatch line</strong> — we'll hand-match you with a vetted locksmith from our wider partner network, usually within 15 minutes.</li>
              <li>Expand your search radius from inside your job page (one tap) so locksmiths within a 25-mile range can see your request.</li>
              <li>Or, if it's no longer urgent, cancel the job in one click — you haven't paid anything.</li>
            </ul>
          </div>

          <div class="cta-wrap">
            <a href="tel:${t.priorityPhoneTel}" class="cta">📞 Call priority line: ${t.priorityPhone}</a>
            <span class="cta-sub">Average pickup time: under 30 seconds, 24/7</span>
            <a href="${t.jobUrl}" class="secondary">→ Or manage your job online</a>
          </div>

          <div class="guarantee">
            <strong>Our promise to you:</strong> you haven't been charged anything — you only ever pay an assessment fee after a locksmith accepts your job and you approve their fee. We only win when you win.
          </div>

          <p class="signoff">Sorry for the inconvenience — we're working on it right now.<br/>The LockSafe UK Dispatch Team</p>
        </div>
        <div class="footer">
          <p style="margin:0;">${o.SITE_NAME} — UK's First Anti-Fraud Locksmith Platform</p>
          <p style="margin:6px 0 0 0;">Need anything else? ${o.SUPPORT_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`Quick update on your locksmith request ${t.jobNumber}`,html:i})}async function D(e,t,i){let r=i?.signupUrl||`${o.SITE_URL}/for-locksmiths?utm_source=invite&utm_medium=email&utm_campaign=partner-outreach`,a=i?.subject||`${t.locksmithName} — join LockSafe UK's verified locksmith network (free)`,s=i?.ctaText||"Apply to Join — It's Free",d=i?.introOverride||`My name is Alex, co-founder of <strong>LockSafe UK</strong> — the UK's first anti-fraud locksmith platform.
            We're building a trusted network of <strong>vetted, independent locksmiths</strong> across the country,
            and your business in ${t.city} caught our eye.`,p=i?.trackPixelUrl?`<img src="${i.trackPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`:"";return n({to:e,subject:a,replyTo:"contact@locksafe.uk",html:`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Join LockSafe UK – Partner Invitation</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
        .wrapper { max-width: 620px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 40px 40px 32px; text-align: center; }
        .logo-badge { display: inline-block; background: #f97316; color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 20px; margin-bottom: 20px; }
        .header h1 { color: #ffffff; font-size: 26px; font-weight: 700; line-height: 1.3; }
        .header p { color: #94a3b8; font-size: 15px; margin-top: 10px; }
        .body { padding: 40px; }
        .greeting { font-size: 17px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
        .intro { font-size: 15px; color: #475569; line-height: 1.7; margin-bottom: 24px; }
        .highlight-box { background: #fff7ed; border-left: 4px solid #f97316; border-radius: 0 8px 8px 0; padding: 18px 20px; margin-bottom: 28px; }
        .highlight-box p { font-size: 14px; color: #7c2d12; font-weight: 600; margin-bottom: 4px; }
        .highlight-box span { font-size: 13px; color: #9a3412; }
        .benefits { margin-bottom: 32px; }
        .benefits h3 { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.04em; }
        .benefit-item { display: flex; align-items: flex-start; margin-bottom: 12px; }
        .benefit-icon { width: 22px; height: 22px; background: #dcfce7; border-radius: 50%; text-align: center; line-height: 22px; font-size: 12px; flex-shrink: 0; margin-right: 12px; margin-top: 1px; }
        .benefit-text { font-size: 14px; color: #334155; line-height: 1.5; }
        .benefit-text strong { color: #0f172a; }
        .cta-section { text-align: center; background: #f8fafc; border-radius: 12px; padding: 32px 24px; margin-bottom: 28px; }
        .cta-section p { font-size: 14px; color: #64748b; margin-bottom: 20px; }
        .cta-button { display: inline-block; background: #f97316; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: 700; padding: 16px 40px; border-radius: 10px; letter-spacing: 0.02em; }
        .cta-sub { font-size: 12px; color: #94a3b8; margin-top: 14px; }
        .social-proof { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px; }
        .social-proof h4 { font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
        .stat-row { display: flex; gap: 0; }
        .stat { flex: 1; text-align: center; padding: 0 8px; border-right: 1px solid #e2e8f0; }
        .stat:last-child { border-right: none; }
        .stat-num { font-size: 22px; font-weight: 800; color: #f97316; }
        .stat-label { font-size: 11px; color: #64748b; margin-top: 2px; }
        .closing { font-size: 15px; color: #475569; line-height: 1.7; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
        .footer p { font-size: 12px; color: #94a3b8; line-height: 1.6; }
        .footer a { color: #f97316; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="wrapper">

        <!-- Header -->
        <div class="header">
          <div class="logo-badge">🔐 LockSafe UK</div>
          <h1>We'd love to partner with you</h1>
          <p>An exclusive invitation for independent locksmiths in ${t.city}</p>
        </div>

        <!-- Body -->
        <div class="body">

          <p class="greeting">Hi ${t.locksmithName},</p>

          <p class="intro">
            ${d}
          </p>

          <div class="highlight-box">
            <p>🎯 We're actively looking for partners in ${t.city}</p>
            <span>We receive emergency locksmith jobs in your area that we can't fulfil without a trusted local professional like you.</span>
          </div>

          <!-- Benefits -->
          <div class="benefits">
            <h3>What you get as a LockSafe partner</h3>

            <div class="benefit-item">
              <div class="benefit-icon">💼</div>
              <div class="benefit-text"><strong>Guaranteed job leads</strong> — receive verified customer bookings directly from our platform, no cold calls.</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon">🛡️</div>
              <div class="benefit-text"><strong>Fraud-free customers</strong> — every job is pre-screened. We protect you from time-wasters and scammers.</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon">💳</div>
              <div class="benefit-text"><strong>Fast payments</strong> — get paid within 24 hours of job completion via Stripe, no chasing invoices.</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon">⭐</div>
              <div class="benefit-text"><strong>Verified reviews</strong> — build your reputation with genuine customer reviews shown on your public profile.</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon">📱</div>
              <div class="benefit-text"><strong>Simple app</strong> — manage jobs, availability and payments from your phone. No paperwork.</div>
            </div>
            <div class="benefit-item">
              <div class="benefit-icon">🆓</div>
              <div class="benefit-text"><strong>Free to join</strong> — we take a platform fee from 15% per completed job only. Zero upfront cost, zero monthly subscription.</div>
            </div>
          </div>

          <!-- Social Proof Stats -->
          <div class="social-proof">
            <h4>LockSafe in numbers</h4>
            <div class="stat-row">
              <div class="stat">
                <div class="stat-num">4.9★</div>
                <div class="stat-label">Avg. customer rating</div>
              </div>
              <div class="stat">
                <div class="stat-num">\xa30</div>
                <div class="stat-label">To join the network</div>
              </div>
              <div class="stat">
                <div class="stat-num">24h</div>
                <div class="stat-label">Payment guarantee</div>
              </div>
            </div>
          </div>

          <!-- CTA -->
          <div class="cta-section">
            <p>Takes less than 5 minutes. No commitment required — see if it's right for your business first.</p>
            <a href="${r}" class="cta-button">${s}</a>
            <p class="cta-sub">Or simply reply to this email with any questions — I read every reply personally.</p>
          </div>

          <p class="closing">
            Looking forward to hopefully working together, ${t.locksmithName}.<br /><br />
            Best regards,<br />
            <strong>Alex Piky</strong><br />
            Co-founder, LockSafe UK<br />
            <a href="tel:+442045771989" style="color:#f97316;">+44 20 4577 1989</a> | <a href="https://locksafe.uk" style="color:#f97316;">locksafe.uk</a>
          </p>

        </div>

        <!-- Footer -->
        <div class="footer">
          <p>
            LockSafe UK Ltd — UK's First Anti-Fraud Locksmith Platform<br />
            <a href="https://locksafe.uk">locksafe.uk</a> \xb7 <a href="mailto:contact@locksafe.uk">contact@locksafe.uk</a>
          </p>
          <p style="margin-top:10px;">
            You're receiving this because your business appeared in our search for independent locksmiths in ${t.city}.<br />
            <a href="https://locksafe.uk/unsubscribe">Unsubscribe</a>
          </p>
        </div>

      </div>
      ${p}
    </body>
    </html>
  `})}async function Y(e,t,i){let r=i?.signupUrl||`${o.SITE_URL}/for-locksmiths?utm_source=lead_email&utm_medium=outreach&utm_campaign=lead-sequence_followup`,a=i?.subject||"It seems like the numbers matter",s=i?.ctaText||(i?.track==="manager"?"Review Team Setup":"Review the Breakdown"),d=i?.trackPixelUrl?`<img src="${i.trackPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;" />`:"",p=i?.track==="manager"?["Bring your team onto one clear workflow instead of juggling separate job streams.","Keep split settings visible so you can decide what works best for your operation.","Use one platform for lead flow, team coordination, and customer communication."]:["Receive verified local jobs without paying monthly fees.","Keep control over which jobs you accept and how you work them.","Move faster with a clear payment flow and less admin."],l=i?.track==="manager"?[["Assessment fee","15% standard platform commission"],["Work quote","25% standard platform commission"],["Team structure","Split settings can be discussed with your team setup"]]:[["Assessment fee","15% platform commission"],["Work quote","25% platform commission"],["Payouts","Clear, tracked job-by-job earnings"]],c=`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${a}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; }
        .wrapper { max-width: 620px; margin: 32px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #7c2d12 0%, #f97316 100%); padding: 36px 40px 28px; text-align: center; color: #ffffff; }
        .badge { display: inline-block; background: rgba(255,255,255,0.16); color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 14px; border-radius: 20px; margin-bottom: 16px; }
        .header h1 { font-size: 26px; line-height: 1.3; }
        .body { padding: 40px; }
        .intro { font-size: 16px; line-height: 1.75; color: #334155; margin-bottom: 20px; }
        .section { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; }
        .section h3 { font-size: 15px; color: #9a3412; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
        .list { padding-left: 20px; color: #7c2d12; line-height: 1.7; }
        .list li { margin-bottom: 8px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table td { padding: 10px 0; border-top: 1px solid #fdba74; vertical-align: top; }
        .table td:first-child { font-weight: 600; color: #7c2d12; width: 42%; padding-right: 16px; }
        .table td:last-child { color: #9a3412; }
        .cta { text-align: center; background: #f8fafc; border-radius: 12px; padding: 28px 24px; margin: 24px 0; }
        .button { display: inline-block; background: #f97316; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: 700; padding: 16px 34px; border-radius: 10px; }
        .cta-sub { font-size: 12px; color: #94a3b8; margin-top: 12px; }
        .closing { font-size: 15px; color: #475569; line-height: 1.7; }
        .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center; }
        .footer p { font-size: 12px; color: #94a3b8; line-height: 1.6; }
        .footer a { color: #f97316; text-decoration: none; }
        @media only screen and (max-width: 600px) {
          .wrapper { margin: 0; border-radius: 0; }
          .body { padding: 24px; }
          .header { padding: 28px 24px 22px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="badge">LockSafe UK</div>
          <h1>${i?.track==="manager"?"It seems like team clarity matters":"It seems like the numbers matter"}</h1>
        </div>
        <div class="body">
          <p class="intro">Hi ${t.locksmithName},</p>
          <p class="intro">It seems like the main question after the first email is simple: what does this actually look like for your time and earnings?</p>

          <div class="section">
            <h3>What locksmiths usually want to know</h3>
            <ul class="list">
              ${p.map(e=>`<li>${e}</li>`).join("")}
            </ul>
          </div>

          <div class="section">
            <h3>Commission structure</h3>
            <table class="table">
              <tbody>
                ${l.map(([e,t])=>`<tr><td>${e}</td><td>${t}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>

          <div class="cta">
            <a href="${r}" class="button">${s}</a>
            <p class="cta-sub">If something in the setup would need to be different for your business, reply and tell us what would make it work.</p>
          </div>

          <p class="closing">
            Thanks for taking a look, ${t.locksmithName}. If the structure is close but not quite right, reply with the part that matters most to you and we’ll work from there.<br /><br />
            Best regards,<br />
            <strong>Alex Pido</strong><br />
            Co-founder, LockSafe UK
          </p>
        </div>
        <div class="footer">
          <p>
            LockSafe UK Ltd — UK's First Anti-Fraud Locksmith Platform<br />
            <a href="https://locksafe.uk">locksafe.uk</a> \xb7 <a href="mailto:contact@locksafe.uk">contact@locksafe.uk</a>
          </p>
          <p style="margin-top:10px;">
            You're receiving this because your business appeared in our search for trusted locksmiths in ${t.city}.<br />
            <a href="https://locksafe.uk/unsubscribe">Unsubscribe</a>
          </p>
        </div>
      </div>
      ${d}
    </body>
    </html>
  `;return n({to:e,subject:a,replyTo:"contact@locksafe.uk",html:c})}async function F(e){let t=e.isReminder?`Reminder: How was your locksmith? (Job ${e.jobNumber})`:`How did ${e.locksmithName} do? Leave a quick review`,i=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; background: #f1f5f9; margin: 0; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; }
        .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; padding: 32px 24px; text-align: center; }
        .body { padding: 32px 24px; }
        .stars { font-size: 32px; letter-spacing: 4px; display: block; text-align: center; margin: 16px 0; }
        .cta { display: block; background: #6366f1; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 10px; text-align: center; font-size: 18px; font-weight: 600; margin: 24px auto; width: fit-content; }
        .footer { text-align: center; padding: 16px 24px; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">🔑 LockSafe UK</div>
            <div style="opacity: 0.85; font-size: 15px;">Job ${e.jobNumber} Complete</div>
          </div>
          <div class="body">
            <h2 style="margin-top:0; font-size:22px;">Hi ${e.customerName},</h2>
            <p>Your job with <strong>${e.locksmithName}</strong> is all wrapped up — great!</p>
            <p>It would mean a lot if you could spare 30 seconds to rate your experience. Your honest feedback helps us maintain quality and helps other customers choose wisely.</p>
            <span class="stars">⭐⭐⭐⭐⭐</span>
            <a href="${e.reviewUrl}" class="cta">Leave a Review →</a>
            <p style="font-size:13px; color:#64748b; text-align:center; margin-top:8px;">Takes less than 30 seconds \xb7 No account needed</p>
          </div>
          <div class="footer">
            LockSafe UK \xb7 <a href="${o.SITE_URL}/unsubscribe" style="color:#94a3b8;">Unsubscribe</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e.customerEmail,subject:t,html:i})}async function K(e){let t={lockout:"lockout",broken:"broken lock repair","key-stuck":"stuck key","lost-keys":"lost key replacement",burglary:"burglary repair",other:"locksmith job"}[e.lastJobType]??"locksmith job",i=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; background: #f1f5f9; margin: 0; padding: 20px; }
        .container { max-width: 560px; margin: 0 auto; }
        .card { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; padding: 32px 24px; text-align: center; }
        .body { padding: 32px 24px; }
        .tip { background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .cta { display: block; background: #0ea5e9; color: white !important; text-decoration: none; padding: 16px 32px; border-radius: 10px; text-align: center; font-size: 17px; font-weight: 600; margin: 24px auto; width: fit-content; }
        .footer { text-align: center; padding: 16px 24px; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">🔑 LockSafe UK</div>
            <div style="opacity: 0.85; font-size: 15px;">Annual lock health reminder</div>
          </div>
          <div class="body">
            <h2 style="margin-top:0; font-size:22px;">Hi ${e.customerName}!</h2>
            <p>It's been a while since your <strong>${t}</strong> on ${e.lastJobDate}.</p>
            <div class="tip">
              <strong>🔒 Did you know?</strong> Locksmiths recommend a lock health check every 12 months — especially for external doors. A quick inspection can prevent an emergency lockout before it happens.
            </div>
            <p>If you need any lock work, maintenance, or an upgrade, we've got you covered. Same trusted platform, same transparent pricing, same verified locksmiths.</p>
            ${e.referralCode?`<p>🎁 <strong>Refer a friend</strong> using your code <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${e.referralCode}</code> and you'll both get <strong>\xa310 off</strong> your next job.</p>`:""}
            <a href="${e.bookingUrl}" class="cta">Book a Lock Health Check →</a>
          </div>
          <div class="footer">
            LockSafe UK \xb7 <a href="${o.SITE_URL}/unsubscribe" style="color:#94a3b8;">Unsubscribe</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e.customerEmail,subject:`${e.customerName}, time for your annual lock check? 🔒`,html:i})}async function H(e,t,i){let r=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #f59e0b); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; text-align: center; border: 2px solid #fed7aa; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .badge { display: inline-block; background: #fef3c7; color: #b45309; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 18px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:48px;margin-bottom:8px;">🎉</div>
          <h1 style="margin:0;font-size:24px;">Your friend joined LockSafe!</h1>
        </div>
        <div class="content">
          <p>Hi ${t},</p>
          <p>Great news — <strong>${i}</strong> just created a LockSafe account using your referral link!</p>

          <div class="box">
            <p style="margin:0 0 8px 0;color:#64748b;font-size:14px;">You're almost there! Once they complete their first job, you'll earn:</p>
            <div class="badge">\xa310 credit</div>
          </div>

          <p>Share your link with more friends to keep earning:</p>
          <p style="background:#fff;border:1px solid #e2e8f0;padding:12px;border-radius:8px;font-family:monospace;text-align:center;">
            ${o.SITE_URL}/ref/YOUR_CODE
          </p>

          <p style="color:#64748b;font-size:13px;">
            Your \xa310 credit will be automatically added to your account once ${i}'s first locksmith job is completed.
          </p>
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} \xb7 <a href="${o.SITE_URL}" style="color:#f97316;">locksafe.uk</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`${i} just joined using your LockSafe link!`,html:r})}async function M(e,t,i){let r=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; text-align: center; border: 2px solid #bbf7d0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .amount { font-size: 48px; font-weight: 800; color: #16a34a; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:48px;margin-bottom:8px;">💰</div>
          <h1 style="margin:0;font-size:24px;">You earned a referral reward!</h1>
        </div>
        <div class="content">
          <p>Hi ${t},</p>
          <p>Your referral just completed their first LockSafe job — and your reward is ready!</p>

          <div class="box">
            <p style="margin:0 0 4px 0;color:#64748b;font-size:14px;">Account credit added:</p>
            <div class="amount">\xa3${i.toFixed(2)}</div>
          </div>

          <p>Your credit has been added to your LockSafe account and will automatically apply to your next callout fee.</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/dashboard" class="button">View Your Credits</a>
          </p>

          <p style="color:#64748b;font-size:13px;margin-top:24px;">
            Keep sharing your link to earn more! Every friend who completes a job earns you \xa3${i.toFixed(2)}.
          </p>
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} \xb7 <a href="${o.SITE_URL}" style="color:#f97316;">locksafe.uk</a></p>
        </div>
      </div>
    </body>
    </html>
  `;return n({to:e,subject:`You earned \xa3${i.toFixed(2)}! Your referral credit is ready.`,html:r})}async function W(e,t,i,r){let a=r?`<p style="background:#dbeafe;border:1px solid #93c5fd;padding:12px 16px;border-radius:8px;color:#1e40af;font-size:14px;">
        Your <strong>7-day free trial</strong> is active until <strong>${r.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong>. No charge until then.
       </p>`:"";return n({to:e,subject:"Welcome to LockSafe Cover — you're protected!",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .benefit { display: flex; align-items: flex-start; gap: 12px; background: white; padding: 14px 16px; border-radius: 8px; margin: 8px 0; }
        .icon { width: 32px; height: 32px; background: #fff7ed; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:48px;margin-bottom:8px;">🛡️</div>
          <h1 style="margin:0;font-size:24px;">Welcome to LockSafe Cover!</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;">${"cover_annual"===i?"Annual Plan":"Monthly Plan"}</p>
        </div>
        <div class="content">
          <p>Hi ${t},</p>
          <p>You're now covered! Here's what you get with LockSafe Cover:</p>

          ${a}

          <div class="benefit">
            <div class="icon">⚡</div>
            <div>
              <strong>50% off all callouts</strong><br>
              <span style="color:#64748b;font-size:14px;">Half-price assessment fee on every job. Automatically applied at checkout.</span>
            </div>
          </div>
          <div class="benefit">
            <div class="icon">🎯</div>
            <div>
              <strong>Priority dispatch</strong><br>
              <span style="color:#64748b;font-size:14px;">Your jobs are matched with more locksmiths in a wider area — faster response times.</span>
            </div>
          </div>
          <div class="benefit">
            <div class="icon">🎁</div>
            <div>
              <strong>1 free callout per month</strong><br>
              <span style="color:#64748b;font-size:14px;">One completely free assessment fee every billing period. Resets automatically.</span>
            </div>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/dashboard" class="button">Go to My Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>Questions? Reply to this email. \xb7 <a href="${o.SITE_URL}/customer/cover" style="color:#f97316;">Manage Cover</a></p>
          <p>${o.SITE_NAME} \xb7 Cancel anytime, no fees.</p>
        </div>
      </div>
    </body>
    </html>
  `})}async function B(e,t,i,r,a){let s="cover_annual"===i?"Annual Plan":"Monthly Plan";return n({to:e,subject:"LockSafe Cover renewed — your free callout is ready",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e293b; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; border: 1px solid #e2e8f0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">LockSafe Cover Renewed</h1>
          <p style="margin:8px 0 0;opacity:0.8;">${s}</p>
        </div>
        <div class="content">
          <p>Hi ${t},</p>
          <p>Your LockSafe Cover has renewed successfully. You're still protected!</p>

          <div class="box">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;">Plan</span>
              <strong>${s}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;">Amount charged</span>
              <strong>\xa3${a.toFixed(2)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;">
              <span style="color:#64748b;">Next renewal</span>
              <strong>${r.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong>
            </div>
          </div>

          <p>Your free monthly callout has been reset and is ready to use.</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/cover" class="button">Manage Cover</a>
          </p>
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} \xb7 <a href="${o.SITE_URL}/customer/cover" style="color:#f97316;">Cancel anytime</a></p>
        </div>
      </div>
    </body>
    </html>
  `})}async function q(e,t){return n({to:e,subject:"LockSafe Cover has been cancelled",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #64748b; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #f97316; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:24px;">LockSafe Cover Cancelled</h1>
        </div>
        <div class="content">
          <p>Hi ${t},</p>
          <p>Your LockSafe Cover subscription has been cancelled. Your benefits (50% off, priority dispatch, free callouts) will remain active until the end of your current billing period.</p>

          <p>We're sorry to see you go. If you change your mind, you can reactivate at any time:</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/cover" class="button">Reactivate Cover</a>
          </p>

          <p style="color:#64748b;font-size:13px;">
            If you cancelled by mistake or have questions, reply to this email and we'll help right away.
          </p>
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} \xb7 We'd love to have you back.</p>
        </div>
      </div>
    </body>
    </html>
  `})}async function J(e,t,i){let r=i?`We'll try again on <strong>${i.toLocaleDateString("en-GB",{day:"numeric",month:"long"})}</strong>.`:"We'll try again shortly.";return n({to:e,subject:"Action required: LockSafe Cover payment failed",html:`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .alert { background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
          <h1 style="margin:0;font-size:22px;">Action Required: Payment Failed</h1>
        </div>
        <div class="content">
          <p>Hi ${t},</p>

          <div class="alert">
            <strong>Your LockSafe Cover payment failed.</strong>
            <p style="margin:4px 0 0 0;color:#dc2626;font-size:14px;">${r} If payment fails again, your Cover subscription will be paused.</p>
          </div>

          <p>To keep your benefits active (50% off callouts, priority dispatch, free monthly callout), please update your payment method:</p>

          <p style="text-align:center;margin-top:24px;">
            <a href="${o.SITE_URL}/customer/cover" class="button">Update Payment Method</a>
          </p>

          <p style="color:#64748b;font-size:13px;">
            Need help? Reply to this email and our team will assist you.
          </p>
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} \xb7 <a href="${o.SITE_URL}/customer/cover" style="color:#f97316;">Manage Cover</a></p>
        </div>
      </div>
    </body>
    </html>
  `})}async function G(e,t){let i=t.daysUntilExpiry<=7,r=t.daysUntilExpiry<=0?"has expired":1===t.daysUntilExpiry?"expires tomorrow":`expires in ${t.daysUntilExpiry} days`,s=`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: system-ui, sans-serif; line-height: 1.6; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { ${i?"background: linear-gradient(135deg, #dc2626, #b91c1c);":"background: linear-gradient(135deg, #7c3aed, #6d28d9);"} color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; }
        .box { background: white; padding: 20px; border-radius: 12px; margin: 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 24px; }
        .button { display: inline-block; background: #7c3aed; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
        .alert { background: ${i?"#fef2f2":"#f5f3ff"}; border: 2px solid ${i?"#fecaca":"#ddd6fe"}; padding: 16px; border-radius: 12px; text-align: center; }
        .countdown { font-size: 48px; font-weight: bold; color: ${i?"#dc2626":"#7c3aed"}; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0;font-size:28px;">🔒 DBS Certificate ${t.daysUntilExpiry<=0?"Expired":"Expiring Soon"}</h1>
          <p style="margin:8px 0 0 0;opacity:0.9;font-size:16px;">Action required for your LockSafe account</p>
        </div>
        <div class="content">
          <div class="alert">
            <p class="countdown">${t.daysUntilExpiry<=0?"EXPIRED":t.daysUntilExpiry}</p>
            <p style="margin:0;color:${i?"#991b1b":"#4c1d95"};font-weight:600;">
              ${t.daysUntilExpiry<=0?"Your DBS certificate has expired":`day${1===t.daysUntilExpiry?"":"s"} until expiry`}
            </p>
          </div>

          <p>Hi ${t.locksmithName},</p>
          <p>
            Your DBS (Disclosure and Barring Service) certificate ${r}.
            ${t.daysUntilExpiry<=0?"Your account has been restricted until you upload a valid DBS certificate.":"Please renew your DBS check and upload the new certificate to continue accepting jobs without interruption."}
          </p>

          <div class="box">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:12px 0;color:#64748b;">Current Expiry Date</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;${i?"color:#dc2626;":""}">${t.expiryDate.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</td>
              </tr>
              ${t.companyName?`
              <tr>
                <td style="padding:12px 0;color:#64748b;border-top:1px solid #e2e8f0;">Company</td>
                <td style="padding:12px 0;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${t.companyName}</td>
              </tr>
              `:""}
            </table>
          </div>

          <div class="box" style="background:${i?"#fef2f2":"#f5f3ff"};border:1px solid ${i?"#fecaca":"#ddd6fe"};">
            <p style="margin:0;color:${i?"#991b1b":"#4c1d95"};font-weight:600;">
              ${i?"⚠️ Urgent Action Required":"✓ What to do next"}
            </p>
            <ol style="margin:12px 0 0 0;color:${i?"#dc2626":"#6d28d9"};padding-left:20px;">
              <li>Apply for a new DBS check via the Gov.uk portal or your employer</li>
              <li>Log in to your LockSafe account</li>
              <li>Go to Settings → Insurance &amp; Documentation</li>
              <li>Upload your new DBS certificate</li>
              <li>Enter the new expiry date</li>
            </ol>
          </div>

          <p style="text-align:center;margin-top:24px;">
            <a href="${t.renewUrl}" class="button">Update DBS Certificate Now</a>
          </p>

          ${t.daysUntilExpiry<=0?`
          <p style="background:#fef2f2;border:1px solid #fecaca;padding:12px 16px;border-radius:8px;color:#991b1b;font-size:14px;margin-top:24px;">
            <strong>Important:</strong> Your ability to accept new jobs has been suspended until a valid DBS certificate is provided.
            Upload your renewed DBS certificate to restore your account.
          </p>
          `:t.daysUntilExpiry<=7?`
          <p style="background:#f5f3ff;border:1px solid #ddd6fe;padding:12px 16px;border-radius:8px;color:#4c1d95;font-size:14px;margin-top:24px;">
            <strong>Note:</strong> If your DBS certificate expires before you renew, your ability to accept new jobs will be temporarily suspended.
          </p>
          `:""}
        </div>
        <div class="footer">
          <p>${o.SITE_NAME} - Locksmith Partner Portal</p>
          <p>Need admin help? Call ${o.LOCKSMITH_ADMIN_PHONE} or <a href="${a}" style="color:#7c3aed;">WhatsApp Admin</a></p>
        </div>
      </div>
    </body>
    </html>
  `,d=t.daysUntilExpiry<=0?"DBS Certificate Expired - Action Required":`DBS Certificate ${r}`;return n({to:e,subject:`${i?"🚨 URGENT":"⚠️ Reminder"}: ${d}`,html:s})}e.s(["sendAccountVerifiedEmail",0,y,"sendAppInstallReminderEmail",0,r,"sendAutoCompletionEmail",0,T,"sendAutoDispatchEmail",0,N,"sendCoverCanceledEmail",0,q,"sendCoverPaymentFailedEmail",0,J,"sendCoverRenewalEmail",0,B,"sendCoverWelcomeEmail",0,W,"sendCustomerOnboardingEmail",0,R,"sendCustomerPaymentLinkEmail",0,x,"sendDbsExpiryReminderEmail",0,G,"sendEarningsReversalEmail",0,U,"sendEmail",0,n,"sendInsuranceExpiryReminderEmail",0,I,"sendJobCompletionEmail",0,f,"sendJobConfirmationEmail",0,c,"sendLocksmithApplicationNotification",0,b,"sendLocksmithArrivedEmail",0,L,"sendLocksmithAssignmentEmail",0,h,"sendLocksmithBookedEmail",0,v,"sendLocksmithFirstLoginInstallOptionsEmail",0,l,"sendLocksmithFollowUpEmail",0,Y,"sendLocksmithInviteEmail",0,D,"sendLocksmithVerifiedEmail",0,j,"sendLocksmithWelcomeEmail",0,p,"sendNewJobInAreaEmail",0,A,"sendNewReviewEmail",0,E,"sendNoLocksmithAvailableEmail",0,O,"sendOnboardingCompleteEmail",0,_,"sendPasswordResetEmail",0,d,"sendPaymentReceiptEmail",0,$,"sendPayoutFailedEmail",0,u,"sendPayoutNotificationEmail",0,m,"sendPhoneRequestContinuationEmail",0,C,"sendQuoteAcceptedEmail",0,z,"sendQuoteDeclinedEmail",0,S,"sendQuoteReceivedEmail",0,g,"sendReferralRewardEmail",0,M,"sendReferralSignupEmail",0,H,"sendReviewRequestEmail",0,F,"sendSignatureReminderEmail",0,P,"sendStripeOnboardingReminderEmail",0,i,"sendTransferNotificationEmail",0,w,"sendVerificationEmail",0,s,"sendWinBackEmail",0,K,"sendWorkCompletionConfirmationEmail",0,k],492749)}];

//# sourceMappingURL=src_lib_email_ts_0kzbpfl._.js.map