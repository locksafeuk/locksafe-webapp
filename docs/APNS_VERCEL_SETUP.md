# APNs Push Notification — Vercel Environment Variables Setup

All code has been implemented and pushed to GitHub. This is the **only remaining step** to enable native iOS push notifications on production.

## Steps to Add Env Vars in Vercel

1. Go to [vercel.com](https://vercel.com) and log in (use GitHub / passkey)
2. Open the **locksafe-webapp** project
3. Go to **Settings → Environment Variables**
4. Add each variable below for **All Environments** (Production, Preview, Development)

---

## Variables to Add

### 1. `APNS_KEY_ID`
```
VPCD4Y2G58
```

### 2. `APNS_TEAM_ID`
```
4ZNRAB4A2S
```

### 3. `APNS_BUNDLE_ID`
```
uk.locksafe.app
```

### 4. `APNS_PRIVATE_KEY`

Paste this **exactly** as shown (including the header and footer lines):
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgzjdaIU/TXSoPB0PR
OSCMVDFv3kr0E1fuVOduUo2d28qgCgYIKoZIzj0DAQehRANCAARVE2RxDmAkCbR0
zV9LbcSQRrEUrOH06XAK79uzyIiH6mw2I6Rr/ofgnu19w/1EZ1lXyMz99V/yPVB9
4erpISBt
-----END PRIVATE KEY-----
```

> **Note:** Vercel stores multi-line values correctly when you paste them directly. The code automatically handles newline conversion.

---

## After Adding the Variables

1. Click **Save** for each variable
2. **Redeploy** the project — go to **Deployments**, find the latest deployment, click the `...` menu → **Redeploy**
   - Or just push a new commit and Vercel will auto-deploy

---

## Verify It's Working

Once deployed, when a new job is created:
1. The server will send a push notification via APNs to all nearby iOS locksmiths
2. You'll see logs in Vercel **Functions** logs: `[NativePush] Sent to <name> (ios)`

---

## Optional: Android Push (FCM) — Add Later

If you want native Android push as well, you'll need to set up Firebase and add:
- `FCM_PROJECT_ID` — from Firebase Console → Project Settings
- `FCM_SERVICE_ACCOUNT_JSON` — Service account JSON (from Firebase Console → Project Settings → Service Accounts → Generate New Private Key)

Android push is not required now — the native push stack fallback still handles Android notifications.

---

## Key Details (for reference)

| Detail | Value |
|--------|-------|
| APNs Key ID | `VPCD4Y2G58` |
| Apple Team ID | `4ZNRAB4A2S` |
| App Bundle ID | `uk.locksafe.app` |
| Key created | 2026-05-11 |
| Key type | ES256 (Team Scoped, Sandbox + Production) |
| .p8 file location | `/Users/piks/Locksafe Project/locksafe-mobile/AuthKey_VPCD4Y2G58.p8` |
