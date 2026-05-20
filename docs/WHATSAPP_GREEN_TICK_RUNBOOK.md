# WhatsApp Green-Tick (Official Business Account) Setup Runbook

> Goal: Make **LockSafe UK Admin** appear as the chat header (with the green verified tick) on first contact with locksmiths and clients, instead of the raw phone number.
>
> Current state (as of 2026-05-20):
> - WABA exists (`WHATSAPP_BUSINESS_ACCOUNT_ID=841629772244797`)
> - Phone number registered (`WHATSAPP_PHONE_NUMBER_ID=103557090296969`)
> - `WHATSAPP_ACCESS_TOKEN` is a **temporary user token** — must be replaced
> - `WHATSAPP_VERIFY_TOKEN=locksafe_whatsapp_verify_2024`
> - Webhook endpoint live at `https://www.locksafe.uk/api/webhooks/whatsapp` (HMAC-verified)
> - `META_APP_SECRET` — required for webhook signature verification (set in Vercel)

---

## Phase 0 — Run the diagnostic (do this first)

```bash
# Pulls live values from Meta Graph API and prints what's missing
WHATSAPP_ACCESS_TOKEN='...' \
WHATSAPP_PHONE_NUMBER_ID='103557090296969' \
WHATSAPP_BUSINESS_ACCOUNT_ID='841629772244797' \
npx ts-node --project scripts/tsconfig.scripts.json scripts/whatsapp-cloud-status.ts
```

The "Green-Tick Readiness Checklist" at the bottom tells you which of phases 1–5 are still outstanding.

---

## Phase 1 — Replace the temporary token with a permanent System User token

The current token expires every 24 h, which breaks the integration daily.

1. Open <https://business.facebook.com/settings/system-users>
2. Click **Add** → name it `locksafe-whatsapp-system` → role **Admin** → Create.
3. Click **Add Assets** → **Apps** → select the LockSafe WhatsApp app → grant **Full Control**.
4. Click **Add Assets** → **WhatsApp Accounts** → select the WABA → grant **Full Control**.
5. Click **Generate New Token** → select the LockSafe WhatsApp app.
6. Token expiration: **Never**.
7. Permissions (tick both):
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
8. Generate, copy the token.
9. In Vercel → Project → Settings → Environment Variables, update `WHATSAPP_ACCESS_TOKEN` (Production + Preview).
10. Re-deploy (or wait for the next push).
11. Re-run the diagnostic — `Access Token › type` should now read **SYSTEM_USER** and `expires_at` should be **never**.

---

## Phase 2 — Wire the webhook signature secret

The webhook now verifies `X-Hub-Signature-256`. Until `META_APP_SECRET` is set, the route logs a warning and accepts unsigned payloads — fine for bootstrapping, but **not safe for production**.

1. Open <https://developers.facebook.com/apps> → LockSafe WhatsApp app → Settings → Basic.
2. Click **Show** next to **App Secret**, copy.
3. Vercel → env vars → `META_APP_SECRET` = (the value), all environments.
4. Re-deploy.
5. Verify with a test webhook (Meta Developer Console → WhatsApp → Configuration → Test).

---

## Phase 3 — Meta Business Verification (prerequisite for green tick)

1. Open <https://business.facebook.com/settings/security>
2. Under **Business Verification**, click **Start Verification**.
3. Upload:
   - Companies House certificate of incorporation
   - Business utility bill or bank statement (≤ 90 days old, address-matching)
   - Domain ownership proof (Meta usually verifies via the email on the registered domain — make sure `admin@locksafe.uk` or similar exists)
4. Submit. Decision typically takes **2–5 business days**.
5. When approved, the **Verified** badge appears in Business Settings → Business Info.

Re-run the diagnostic — `WhatsApp Business Account › owner verification status` should now read **VERIFIED**.

---

## Phase 4 — Register the display name "LockSafe UK Admin"

1. Open <https://business.facebook.com/wa/manage/phone-numbers/> → select the number.
2. Click **Settings** → **Profile**.
3. **Display name**: `LockSafe UK Admin`
   - Must follow [Meta's display-name guidelines](https://developers.facebook.com/docs/whatsapp/messaging-limits#display-name-guidelines): match the brand, no generic words like "Customer Service", correct capitalisation.
4. **Category**: Local Service / Professional Services
5. **Description**: "LockSafe UK — UK's first locksmith-price-protection platform. Verified locksmiths, fixed pricing, 24/7 support."
6. **Address**: registered company address
7. **Website**: `https://www.locksafe.uk`
8. **Email**: official `@locksafe.uk` email
9. **Profile photo**: LockSafe logo (640×640 PNG, on white)
10. Click **Submit for review**. Decision takes a few hours to **2 days**.

Re-run the diagnostic — `Phone Number › name_status` should be **APPROVED** and `verified_name` should be **LockSafe UK Admin**.

---

## Phase 5 — Build messaging quality for ≥ 2 weeks

Green-tick / OBA approval requires:
- `quality_rating` = **GREEN** sustained for ~2 weeks
- Tier-2 messaging limits or higher (1,000+ unique 24 h conversations)
- Zero/low block-and-report rate from recipients
- Clean policy history (no template rejections, no warning emails)

What that means operationally:
- Send only welcome / job-update / response messages — **no cold marketing** from this number until OBA is approved.
- Use opt-in for any proactive outreach. Wire it into the existing `WhatsAppButton` (locksmiths/admins already give us implicit consent by clicking).
- Watch quality in WhatsApp Manager → Insights → Quality.

---

## Phase 6 — Apply for the green tick (Official Business Account)

Available only once phases 3–5 are green.

1. Open <https://business.facebook.com/wa/manage/home/> → select WABA.
2. **Account Tools** → **Official Business Account** → **Request**.
3. Provide:
   - Brand notability evidence (Trustpilot reviews, press mentions, Companies House registration, domain age, social-media follower counts)
   - Reason: "LockSafe UK is the UK's first locksmith price-protection platform; the verified badge protects our locksmith and customer base from impersonation given that the number is used to send job-related credentials and dispatch instructions."
4. Submit. Meta reviews in **2–4 weeks**. Most first-time requests are rejected; resubmit with stronger notability evidence after 30 days.

When granted, **LockSafe UK Admin** + green tick appears in the chat header at the very first message.

---

## Operational notes

- Once a phone number is on the Cloud API it **cannot be used in the WhatsApp Business app** anymore. The admin device that currently hosts `07818333989` will lose access. Day-to-day chats then live in WhatsApp Manager's inbox or whatever inbox UI we build in `/admin`.
- If we want to keep the existing manual admin chats, register a **new number** on the Cloud API for branded outbound and leave `07818333989` on the phone app.
- The existing `<WhatsAppButton>` (using `wa.me`) continues to work either way — the green tick affects **how the recipient's chat header looks**, not the deep-link mechanism.

---

## Verification commands

```bash
# Webhook GET verification (should echo the challenge)
curl -i "https://www.locksafe.uk/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=locksafe_whatsapp_verify_2024&hub.challenge=test123"

# Webhook POST with wrong signature (should 403 once META_APP_SECRET is set)
curl -i -X POST https://www.locksafe.uk/api/webhooks/whatsapp \
  -H 'content-type: application/json' \
  -H 'x-hub-signature-256: sha256=00' \
  -d '{"object":"whatsapp_business_account","entry":[]}'

# Token + green-tick readiness diagnostic
WHATSAPP_ACCESS_TOKEN='...' \
WHATSAPP_PHONE_NUMBER_ID='103557090296969' \
WHATSAPP_BUSINESS_ACCOUNT_ID='841629772244797' \
npx ts-node --project scripts/tsconfig.scripts.json scripts/whatsapp-cloud-status.ts
```
