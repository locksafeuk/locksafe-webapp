# LockSafe Voice AI — Quick Reference Card

## Key Information

| Item | Value |
|---|---|
| **Phone Number** | +44 20 4577 1989 (`+442045771989`) |
| **Number Status** | ⏳ Pending activation (ordered 9 Apr 2026) |
| **Provider** | Zadarma |
| **Voice AI** | Retell AI |
| **Monthly Cost** | ~$4/month + Retell AI usage |

---

## Dashboards & Portals

| Service | URL |
|---|---|
| **LockSafe Admin** | `https://www.locksafe.uk/admin` |
| **Zadarma Dashboard** | `https://my.zadarma.com` |
| **Retell AI Dashboard** | `https://www.retellai.com/dashboard` |
| **GitHub Repo** | `https://github.com/locksafeuk/locksafe-webapp` |
| **Vercel (if used)** | Check deployment platform |

---

## Zadarma Credentials

- **Login location:** Stored in password manager / Zadarma account
- **SIP Server:** `pbx.zadarma.com`
- **PBX credentials:** Found in Zadarma → Settings → PBX → Extensions

---

## Key Configuration Files

| File | Purpose |
|---|---|
| `src/lib/env.ts` | Environment variable validation (includes `RETELL_API_KEY`) |
| `src/middleware.ts` | Rate limiting & routing (webhook may need exemption) |
| `src/app/api/retell/webhook/` | Retell AI webhook endpoint |
| `.env.local` / `.env.production` | Environment variables (API keys, phone number) |
| `src/lib/rate-limit.ts` | API rate limiting utility |

---

## Environment Variables (Voice AI)

```env
RETELL_API_KEY=key_xxxxxxxxxx
RETELL_PHONE_NUMBER=+442045771989
```

---

## Webhook Configuration

| Setting | Value |
|---|---|
| **Webhook URL** | `https://www.locksafe.uk/api/retell/webhook` |
| **Events** | `call_started`, `call_ended`, `call_analyzed` |
| **SIP Forward** | `+442045771989@sip.retellai.com` |

---

## Quick Troubleshooting

### Calls not connecting?
1. Check Zadarma dashboard — is the number active?
2. Check Retell AI dashboard — is the agent assigned?
3. Verify SIP credentials haven't changed
4. Test with a SIP client (e.g., Zoiper) to isolate the issue

### Webhook not receiving events?
1. Check Retell AI dashboard → Logs for delivery attempts
2. Verify `https://www.locksafe.uk/api/retell/webhook` returns `200 OK`
3. Check middleware rate limiting isn't blocking the webhook
4. Check server logs for errors

### Voice agent not responding correctly?
1. Check Retell AI agent configuration and prompt
2. Review recent call transcripts in Retell dashboard
3. Check if the agent is in "active" state

### Number verification taking too long?
- Contact Zadarma support via their dashboard
- Normal verification: up to 2 business days
- If >3 business days, escalate

---

## Important Reminders

- ⚠️ Number is **not yet active** — do not update production config until verified
- 🔑 Keep `RETELL_API_KEY` secure — never commit to git
- 📞 Incoming calls to Zadarma number are **FREE**
- 💰 Retell AI charges per-minute for AI processing
- 🔄 SIP credentials may rotate — check after any Zadarma PBX changes
