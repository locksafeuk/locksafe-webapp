# LockSafe UK — Phone Number Setup & Activation Guide

## Phone Number Details

| Field | Value |
|---|---|
| **Phone Number** | +44 20 4577 1989 |
| **International** | +442045771989 |
| **Provider** | Zadarma |
| **Type** | London 020 geographic number |
| **Status** | ⏳ Pending verification (up to 2 business days) |
| **Monthly Cost** | $4/month |
| **Incoming Calls** | FREE |
| **Order Date** | 9 April 2026 |
| **Expected Activation** | By 13 April 2026 |

---

## Activation Checklist

Once Zadarma confirms the number is active, follow these steps **in order**:

### Step 1 — Verify Number is Active in Zadarma

- [ ] Log in to [Zadarma Dashboard](https://my.zadarma.com)
- [ ] Navigate to **My Numbers** and confirm +442045771989 shows as **Active**
- [ ] Make a test call to the number to confirm it rings/connects

### Step 2 — Configure Zadarma PBX

- [ ] Go to **Settings → PBX** in Zadarma dashboard
- [ ] Create a PBX extension (e.g., extension `100`) if not already created
- [ ] Note down the following credentials:
  - **SIP Server (Termination URI):** `pbx.zadarma.com`
  - **PBX Extension:** (e.g., `100`)
  - **SIP Username:** (your Zadarma SIP login, found in PBX settings)
  - **SIP Password:** (found in PBX settings → extension credentials)
- [ ] Set the incoming call routing for +442045771989 to forward to the PBX extension

### Step 3 — Configure Retell AI Phone Number

- [ ] Log in to [Retell AI Dashboard](https://www.retellai.com/dashboard)
- [ ] Navigate to **Phone Numbers → Import Number** (or "Bring Your Own Number")
- [ ] Select **SIP Trunk** as the connection method
- [ ] Enter the SIP trunking details:
  - **Termination URI:** `pbx.zadarma.com`
  - **Phone Number:** `+442045771989`
  - **SIP Username:** *(from Step 2)*
  - **SIP Password:** *(from Step 2)*
- [ ] Assign the LockSafe Voice AI agent to this phone number
- [ ] Configure the Retell AI SIP endpoint for call forwarding:
  - **Forward calls to:** `+442045771989@sip.retellai.com`

### Step 4 — Configure Webhook

- [ ] In Retell AI dashboard, set the webhook URL for this phone number:
  - **Webhook URL:** `https://www.locksafe.uk/api/retell/webhook`
- [ ] Ensure the webhook receives events for:
  - `call_started`
  - `call_ended`
  - `call_analyzed`
- [ ] Verify the webhook endpoint is deployed and responding with `200 OK`

### Step 5 — Update Application Configuration

- [ ] Add `RETELL_PHONE_NUMBER=+442045771989` to production `.env`
- [ ] Update VoiceAgentConfig in the database/config with the new phone number
- [ ] Verify the phone number displays correctly on the website (contact page, header, etc.)
- [ ] Confirm the `/api/retell/webhook` route is handling incoming call events

### Step 6 — Testing

- [ ] **Inbound call test:** Call +44 20 4577 1989 from a mobile phone
  - Confirm the call connects to Retell AI voice agent
  - Confirm the agent responds with the LockSafe greeting
  - Confirm the webhook receives `call_started` event
- [ ] **End-to-end test:** Complete a full call flow
  - Request a locksmith via voice
  - Confirm the call data appears in the admin dashboard
  - Confirm `call_ended` and `call_analyzed` events fire
- [ ] **Error handling test:** Hang up mid-call and verify graceful handling
- [ ] **After-hours test:** Call outside business hours and verify correct behaviour
- [ ] **Webhook failure test:** Temporarily disable webhook and confirm Retell handles it gracefully

---

## Zadarma Call Forwarding Setup (Alternative — Direct SIP Forward)

If using Zadarma's built-in call forwarding instead of PBX:

1. Go to **My Numbers → +442045771989 → Call Forwarding**
2. Set forwarding destination to: `+442045771989@sip.retellai.com`
3. Set forwarding type: **Unconditional** (all calls)
4. Save and test

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Number not activating | Contact Zadarma support; verification can take up to 2 business days |
| Calls not reaching Retell | Check SIP credentials, verify PBX routing, test with SIP client first |
| Webhook not firing | Check Retell dashboard logs, verify URL is correct and HTTPS |
| Agent not responding | Check Retell AI agent is assigned to the number and is active |
| Poor audio quality | Check Zadarma codec settings (prefer G.711), verify network latency |
| 429 errors on webhook | Check rate limiting in middleware.ts — webhook endpoint may need exemption |

---

## Cost Summary

| Item | Cost |
|---|---|
| Zadarma number (monthly) | $4/month |
| Incoming calls | FREE |
| Retell AI | Per-minute pricing (see Retell plan) |
| **Total fixed monthly** | **~$4/month + Retell usage** |
