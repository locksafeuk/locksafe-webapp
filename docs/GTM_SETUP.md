# Google Tag Manager — Setup Guide

This document explains how the LockSafe web app integrates with Google Tag Manager (GTM) and how to configure the **GTM admin UI** to fire GA4, Google Ads, and Microsoft UET tags. Meta Pixel is intentionally **not** routed through GTM — it stays in the codebase so its `eventID` can be deduplicated against the server-side Meta Conversions API.

- **Container ID:** `GTM-5KX7G8M7`
- **Env var:** `NEXT_PUBLIC_GTM_ID`
- **Migration date:** April 2026

---

## 1. Architecture overview

```
                 ┌───────────────────────────────┐
                 │  Browser (locksafe.uk)        │
                 │                               │
                 │  ┌─────────────────────────┐  │
   user action   │  │ useTrackingEvents()     │  │
 ─────────────► │  │  └─► dataLayer.push(    │  │
                 │  │       'ls_lead', ...)   │  │
                 │  └────────────┬────────────┘  │
                 │               │               │
                 │  ┌────────────▼────────────┐  │
                 │  │ GTM container (gtm.js)  │  │
                 │  │  GA4 Config / Event     │  │
                 │  │  Google Ads Conv.       │  │
                 │  │  Microsoft UET          │  │
                 │  │  (consent-gated)        │  │
                 │  └─────────────────────────┘  │
                 │                               │
                 │  ┌─────────────────────────┐  │
                 │  │ Meta Pixel (direct)     │  │  fbq() + eventID
                 │  └────────────┬────────────┘  │
                 └───────────────┼───────────────┘
                                 │
                       ┌─────────▼──────────┐
                       │ /api/tracking/     │   server-side CAPI
                       │  conversions       │   (deduped via eventID)
                       └────────────────────┘
```

Key points:

1. The app **never calls `gtag()` directly**. All Google/Bing analytics flow through `dataLayer.push()` events that GTM picks up and dispatches.
2. **Consent Mode v2** runs `beforeInteractive` in the page head with all storage **denied by default**. GTM holds tags until the cookie banner pushes a `consent update`.
3. **Meta Pixel** stays direct: it reads `locksafe_cookie_consent` and listens for the `locksafe:consent-changed` window event. It shares an `event_id` with the server CAPI so duplicates are merged in Meta Events Manager.

Relevant code:

- [src/components/analytics/GoogleTagManager.tsx](../src/components/analytics/GoogleTagManager.tsx) — loader + Consent Mode v2 defaults + `pushDataLayerEvent` helper.
- [src/components/analytics/MetaPixel.tsx](../src/components/analytics/MetaPixel.tsx) — direct Meta Pixel, gated on consent.
- [src/components/gdpr/CookieConsent.tsx](../src/components/gdpr/CookieConsent.tsx) — UI, writes `locksafe_cookie_consent`, pushes `gtag('consent', 'update', ...)`.
- [src/hooks/useTrackingEvents.ts](../src/hooks/useTrackingEvents.ts) — the only place app code emits analytics events.
- [src/app/api/tracking/conversions/route.ts](../src/app/api/tracking/conversions/route.ts) — server-side Meta CAPI.
- [next.config.js](../next.config.js) — Content-Security-Policy with GTM/GA/Ads/Bing/Meta allowlist.

---

## 2. Environment variables

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `NEXT_PUBLIC_GTM_ID` | ✅ | GTM container, e.g. `GTM-5KX7G8M7`. Without it, the GTM loader renders nothing and analytics are silently disabled. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | reference only | The GA4 ID `G-5MXF8Z4JXF`. **Configured inside GTM**, not used at runtime any more — kept in `.env` so the admin status page (`/admin/env-status`) can display it. |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | reference only | `AW-XXXXXXXXX`. Configured inside GTM. |
| `NEXT_PUBLIC_BING_UET_TAG_ID` | reference only | Microsoft UET tag ID. Configured inside GTM. |
| `NEXT_PUBLIC_META_PIXEL_ID` | ✅ | Meta Pixel — stays direct in code. |
| `META_CONVERSIONS_API_TOKEN` | ✅ | Server-side Meta CAPI. |
| `META_PIXEL_TEST_CODE` | optional | Sends server CAPI events to the Meta test bucket. |

Set `NEXT_PUBLIC_GTM_ID` in:

- Local: `.env`
- Vercel: Project → Settings → Environment Variables (all environments).
- Netlify: Site settings → Environment variables.

---

## 3. Cookie banner & Consent Mode v2

The cookie banner ([CookieConsent.tsx](../src/components/gdpr/CookieConsent.tsx)) writes a JSON document to `localStorage` under the key `locksafe_cookie_consent`:

```json
{
  "essential": true,
  "functional": false,
  "analytics": false,
  "marketing": false,
  "timestamp": 1714324567890,
  "version": "1.0"
}
```

When the user changes consent, two things happen:

1. **`gtag('consent', 'update', { ... })`** is pushed into `window.dataLayer`. GTM uses this to release any tags configured with "Require additional consent before firing".
2. A `locksafe:consent-changed` `CustomEvent` is dispatched on `window`. The Meta Pixel component listens for it and either initialises the pixel (on grant) or calls `fbq('consent', 'revoke')` (on revoke).

| Banner toggle | Consent Mode v2 signal | Notes |
|---------------|------------------------|-------|
| `essential` | `security_storage = granted` | always granted |
| `functional` | `personalization_storage`, `functionality_storage` | Both default `granted` for site basics; only `personalization_storage` toggles with the user choice. |
| `analytics` | `analytics_storage` | gates **GA4** |
| `marketing` | `ad_storage`, `ad_user_data`, `ad_personalization` | gates **Google Ads**, **Microsoft UET**, **Meta Pixel** |

**Defaults before user choice** (set `beforeInteractive` in [GoogleTagManager.tsx](../src/components/analytics/GoogleTagManager.tsx)):

```
ad_storage:              denied
ad_user_data:            denied
ad_personalization:      denied
analytics_storage:       denied
functionality_storage:   granted
personalization_storage: denied
security_storage:        granted
wait_for_update:         500
url_passthrough:         true
ads_data_redaction:      true
```

`wait_for_update: 500` tells Google tags to **delay 500 ms** so the banner has a chance to update consent before the very first event fires.

---

## 4. dataLayer event reference

Every app event is pushed into `dataLayer` as `event: 'ls_<name>'`. This is the contract between the app and GTM — **do not change event names without also updating GTM triggers.**

| Event name | Fires on | Standard payload |
|------------|----------|------------------|
| `ls_page_view` | (Reserved — currently GA4 handles page_view automatically) | `value`, `currency` |
| `ls_lead` | Postcode submitted, request started | `value` (default 50), `currency` (`GBP`), `postcode`, `event_id` |
| `ls_form_started` | First focus on a form | `formName`, `event_id` |
| `ls_form_abandoned` | User leaves a form mid-flow | `formName`, `formStep`, `event_id` |
| `ls_postcode_entered` | (Alias of `lead`, separate event for finer GA4 funnels) | `postcode`, `value`, `event_id` |
| `ls_quote_received` | Locksmith sends a quote | `jobId`, `quoteValue`, `value`, `event_id` |
| `ls_quote_accepted` | Customer accepts a quote | `jobId`, `quoteValue`, `value`, `event_id` |
| `ls_quote_declined` | Customer declines a quote | `jobId`, `quoteValue`, `value`, `event_id` |
| `ls_assessment_paid` | Stripe assessment fee paid | `jobId`, `assessmentFee`, `value`, `event_id` |
| `ls_add_to_cart` | Quote viewed (Meta funnel parity) | `jobId`, `value`, `event_id` |
| `ls_begin_checkout` | Checkout started | `jobId`, `value`, `event_id` |
| `ls_purchase` | Job completed & paid | `jobId`, `jobNumber`, `value`, `event_id` |
| `ls_job_completed` | Locksmith marks job done | `jobId`, `jobNumber`, `value`, `event_id` |
| `ls_job_cancelled` | Job cancelled | `jobId`, `event_id` |
| `ls_customer_signup` | Customer registers | `userType: "customer"`, `userId`, `event_id` |
| `ls_locksmith_signup` | Locksmith registers | `userType: "locksmith"`, `userId`, `event_id` |
| `ls_locksmith_applied` | Locksmith application submitted | `userId`, `event_id` |
| `ls_review_submitted` | Review left | `jobId`, `event_id` |
| `ls_phone_click` | Click on `tel:` link | `phoneNumber`, `event_id` |
| `ls_exit_intent` | Exit-intent modal shown | `event_id` |
| `ls_lead_magnet_download` | Free guide downloaded | `event_id` |

All events carry `event_id` (timestamp + random) — use this in GTM as a `transaction_id` / `event_id` parameter to enable cross-device dedup.

To add a new event from app code:

```ts
import { useTrackingEvents } from '@/hooks/useTrackingEvents';

const { track } = useTrackingEvents();
await track('lead', { postcode: 'EC1A 1BB', value: 75 });
```

Or, for raw pushes outside the hook:

```ts
import { pushDataLayerEvent } from '@/components/analytics/GoogleTagManager';

pushDataLayerEvent('ls_custom_thing', { foo: 'bar' });
```

---

## 5. GTM admin UI — one-time configuration

Open <https://tagmanager.google.com> and select container `GTM-5KX7G8M7`.

### 5.1 Built-in variables

`Variables → Configure` → enable:

- Page → **Page URL**, **Page Path**, **Page Hostname**, **Referrer**
- Click → **Click URL**, **Click Element**, **Click Text**
- Utilities → **Event**

### 5.2 User-defined variables

Create one **Constant** and one **Data Layer Variable** per dynamic field.

| Type | Name | Value / DL key | Default |
|------|------|----------------|---------|
| Constant | `cv - GA4 Measurement ID` | `G-5MXF8Z4JXF` | — |
| Constant | `cv - Google Ads ID` | (your `AW-XXXXXXXXX` once active) | — |
| Constant | `cv - Bing UET ID` | (your UET ID once active) | — |
| Data Layer Variable | `dlv - value` | `value` | `0` |
| Data Layer Variable | `dlv - currency` | `currency` | `GBP` |
| Data Layer Variable | `dlv - event_id` | `event_id` | — |
| Data Layer Variable | `dlv - jobId` | `jobId` | — |
| Data Layer Variable | `dlv - jobNumber` | `jobNumber` | — |
| Data Layer Variable | `dlv - postcode` | `postcode` | — |
| Data Layer Variable | `dlv - formName` | `formName` | — |
| Data Layer Variable | `dlv - formStep` | `formStep` | — |
| Data Layer Variable | `dlv - userType` | `userType` | — |
| Data Layer Variable | `dlv - phoneNumber` | `phoneNumber` | — |
| Data Layer Variable | `dlv - assessmentFee` | `assessmentFee` | `0` |
| Data Layer Variable | `dlv - quoteValue` | `quoteValue` | `0` |

### 5.3 Triggers

All triggers are **Custom Event** type. The "Event name" field matches the literal string pushed by the app.

| Trigger name | Event name | Notes |
|--------------|------------|-------|
| `CE - ls_lead` | `ls_lead` | |
| `CE - ls_purchase` | `ls_purchase` | |
| `CE - ls_quote_received` | `ls_quote_received` | |
| `CE - ls_quote_accepted` | `ls_quote_accepted` | |
| `CE - ls_quote_declined` | `ls_quote_declined` | |
| `CE - ls_assessment_paid` | `ls_assessment_paid` | |
| `CE - ls_begin_checkout` | `ls_begin_checkout` | |
| `CE - ls_add_to_cart` | `ls_add_to_cart` | |
| `CE - ls_customer_signup` | `ls_customer_signup` | |
| `CE - ls_locksmith_signup` | `ls_locksmith_signup` | |
| `CE - ls_phone_click` | `ls_phone_click` | |
| `CE - ls_form_started` | `ls_form_started` | |
| `CE - ls_form_abandoned` | `ls_form_abandoned` | |
| `CE - all ls_* events` | (set "Event name" → `Use regex matching` → `^ls_.*`) | catch-all, useful for future tags |

### 5.4 Tags

#### A. GA4 Configuration tag

- **Tag type:** Google Tag (Google Analytics: GA4 Configuration in older UIs)
- **Tag ID:** `{{cv - GA4 Measurement ID}}`
- **Send a page view event when this configuration loads:** ✅
- **Configuration parameters (Recommended):**
  - `send_page_view` = `true`
- **Trigger:** `Initialization - All Pages`
- **Advanced → Consent Settings → Require additional consent for tag to fire:** select `analytics_storage`.

#### B. GA4 Event tags (one per conversion)

Create one tag per conversion. Use the GA4 *recommended* event names so Google Ads can import them.

| Tag name | Event name | Trigger | Event parameters |
|----------|------------|---------|------------------|
| `GA4 - generate_lead` | `generate_lead` | `CE - ls_lead` | `value` = `{{dlv - value}}`, `currency` = `{{dlv - currency}}`, `postcode` = `{{dlv - postcode}}`, `event_id` = `{{dlv - event_id}}` |
| `GA4 - purchase` | `purchase` | `CE - ls_purchase` | `transaction_id` = `{{dlv - jobNumber}}`, `value` = `{{dlv - value}}`, `currency` = `{{dlv - currency}}`, `event_id` = `{{dlv - event_id}}` |
| `GA4 - add_to_cart` | `add_to_cart` | `CE - ls_add_to_cart` + `CE - ls_quote_received` | `value`, `currency`, `event_id` |
| `GA4 - begin_checkout` | `begin_checkout` | `CE - ls_begin_checkout` + `CE - ls_assessment_paid` | `value`, `currency`, `event_id` |
| `GA4 - sign_up` | `sign_up` | `CE - ls_customer_signup` + `CE - ls_locksmith_signup` | `method` = `{{dlv - userType}}` |
| `GA4 - phone_call` | `phone_call` | `CE - ls_phone_click` | `phone_number` = `{{dlv - phoneNumber}}` |

For each: **Advanced → Consent Settings → Require `analytics_storage`**.

#### C. Google Ads Conversion Linker

- **Tag type:** Conversion Linker
- **Trigger:** `All Pages`
- **Consent:** require `ad_storage`.

#### D. Google Ads Conversion Tracking tags

Create one per conversion action defined inside Google Ads. You'll get `Conversion ID` (the `AW-...`) and `Conversion Label` per action.

| Tag name | Trigger | Conversion ID | Label | Value | Order ID |
|----------|---------|---------------|-------|-------|----------|
| `GAds - Lead` | `CE - ls_lead` | `{{cv - Google Ads ID}}` | (lead label) | `{{dlv - value}}` | `{{dlv - event_id}}` |
| `GAds - Purchase` | `CE - ls_purchase` | `{{cv - Google Ads ID}}` | (purchase label) | `{{dlv - value}}` | `{{dlv - jobNumber}}` |
| `GAds - Phone click` | `CE - ls_phone_click` | `{{cv - Google Ads ID}}` | (phone label) | — | `{{dlv - event_id}}` |

Consent: require `ad_storage` and `ad_user_data`.

#### E. Microsoft UET tag

- **Tag type:** Custom HTML (paste the UET base script — the tag template marketplace also offers an official one).
- **Trigger:** `All Pages`.
- **Consent:** `ad_storage`.

Then create UET event tags for `ls_lead`, `ls_purchase`, etc., using the `window.uetq.push('event', ...)` API.

### 5.5 Container settings

`Admin → Container Settings`:

- ✅ Enable consent overview (lets you audit which tags need which consent).

`Workspace → Preview` → connect to `https://locksafe.uk` to verify before publishing.

---

## 6. Local development & QA checklist

### 6.1 Smoke test in the browser

1. `npm run dev` → open <http://localhost:3000>.
2. DevTools → Console:
   ```js
   window.dataLayer
   ```
   First entries should be the **consent default** push, then `gtm.start`, then any `ls_*` events as you click around.
3. DevTools → Network → filter `gtm.js`. You should see exactly one request to `https://www.googletagmanager.com/gtm.js?id=GTM-5KX7G8M7`. **No requests to `gtag/js?id=G-...` directly** (those now load via GTM's container).

### 6.2 Cookie banner

| Action | Expected |
|--------|----------|
| First visit | Banner appears after ~1 s. `window.dataLayer` shows consent defaults all denied (except security/functionality). No GA hits in Network. |
| Click "Accept All" | `gtag('consent','update', ...)` push with all storages `granted`. GA4 `page_view` fires. Meta Pixel initialises and fires `PageView`. |
| Click "Essential Only" | Update push with `analytics_storage=denied`, `ad_storage=denied`. No GA, no Meta Pixel. |
| Toggle off "Marketing" via Customise | `fbq('consent','revoke')` is called (visible in Network: stops new `tr/?id=...` requests). |
| Reload page | Saved preferences applied immediately; banner hidden. |

### 6.3 GTM Preview mode

1. In GTM admin → **Preview** → enter `https://locksafe.uk` (or your dev URL via tunneling).
2. Trigger a `ls_lead` event by submitting a postcode on the homepage.
3. The Tag Assistant pane should show:
   - `ls_lead` event in the timeline
   - `GA4 - generate_lead` tag → ✅ Fired
   - `GAds - Lead` → Fired (only if Google Ads ID configured)
   - All consent-gated tags showing the current `analytics_storage` / `ad_storage` state.

### 6.4 Meta Events Manager dedup

1. Open <https://business.facebook.com/events_manager2> → your pixel.
2. Submit a test purchase end-to-end.
3. Check **Test Events** (using `META_PIXEL_TEST_CODE`): a single `Purchase` should appear, **labelled "Browser and Server"** thanks to the shared `event_id`. If you see two separate events, the `event_id` isn't matching — confirm `useTrackingEvents.track()` passes the same `eventId` to both `metaPixel.trackPurchase` and `sendServerEvent`.

### 6.5 CSP audit

After deploy, open the production site, navigate around (`/`, `/request`, `/locksmith`, `/admin`, blog post pages), and watch the Console for `Refused to load … because it violates the following Content Security Policy directive` errors. If any legitimate origin is blocked, add it to the appropriate directive in [next.config.js](../next.config.js)'s `headers()` function.

---

## 7. Adding a new event end-to-end

1. **App code** — call from a component or hook:
   ```ts
   const { track } = useTrackingEvents();
   await track('review_submitted', { jobId });
   ```
   This pushes `event: 'ls_review_submitted'` to the dataLayer.
2. **GTM admin** — create:
   - A Custom Event trigger with event name `ls_review_submitted`.
   - A GA4 Event tag `GA4 - review_submitted` (use GA4 recommended event name — for reviews there isn't one, so a custom `review_submitted` is fine).
   - (Optional) A Google Ads conversion tag if you have a matching conversion action.
3. **Preview, then Submit/Publish** the GTM workspace.
4. Add the event to [§4 dataLayer event reference](#4-datalayer-event-reference) in this doc.

---

## 8. Server-side events (Meta CAPI) — unchanged

The route at [src/app/api/tracking/conversions/route.ts](../src/app/api/tracking/conversions/route.ts) sends server-side events to Meta. It runs **independently of GTM** and is invoked from `useTrackingEvents.track()` for the "important" conversions:

```
lead, assessment_paid, purchase, job_completed,
customer_signup, locksmith_signup, quote_accepted, quote_declined
```

The same `event_id` is used by the browser-side Meta Pixel call and the server CAPI call → Meta deduplicates.

> 🛈 **Future improvement:** move the server endpoint behind a *Server-Side GTM* container. That would let you fan out the same hashed event payload to Google Ads Enhanced Conversions, TikTok Events API, etc., from a single ingestion endpoint. Out of scope today.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No `gtm.js` request in Network | `NEXT_PUBLIC_GTM_ID` is empty in the deployed environment | Set the env var on Vercel/Netlify and redeploy. |
| GA4 hits but no Google Ads conversions | `Conversion Linker` tag missing, or `ad_storage` denied | Add the Conversion Linker tag firing on `All Pages`; check banner toggle. |
| Meta Events Manager shows "Browser only" / "Server only" | `event_id` mismatch | Ensure the app calls `track()` (which generates one `eventId` and threads it through both pipelines). Don't call `metaPixel.trackXxx()` directly. |
| Console: "Refused to load https://… (CSP)" | A new third party isn't in the allowlist | Edit the CSP `connect-src` / `script-src` / `img-src` in [next.config.js](../next.config.js). |
| GTM Preview mode connects but tags show "Not fired — Consent" | User hasn't accepted the relevant category | Click the cookie banner toggle in the live page; consent state is per-browser-per-domain. |
| Two `gtm.js` requests | Old `GoogleAnalytics`/`GoogleAdsTracking` component still imported somewhere | Run: `grep -R "googletagmanager.com/gtag/js" src/` — should return 0 hits. |
| Banner re-appears every load | Consent JSON in localStorage missing `version` field or `timestamp` older than 1 year | Expected for stale entries. Bump `CONSENT_VERSION` in [CookieConsent.tsx](../src/components/gdpr/CookieConsent.tsx) only when adding new categories. |

---

## 10. Change log

| Date | Change |
|------|--------|
| 2026-04-28 | Initial migration: GA4 + Google Ads + Microsoft UET moved into GTM. Meta Pixel kept direct. Consent Mode v2 deny-by-default. CSP added. |
