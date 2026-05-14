# LockSafe UK — Full-Site QA Bug Report

**Date**: 2025  
**Scope**: 100% feature check — Admin portal, Locksmith portal, Customer portal, Public pages  
**Auditor**: GitHub Copilot automated QA agent  

---

## Summary

| # | Severity | Component | Title | Status |
|---|----------|-----------|-------|--------|
| 1 | HIGH | Locksmith Portal | SSE notifications immediately abort on Vercel serverless | ✅ Fixed |
| 2 | MEDIUM | Locksmith Portal | Dashboard "Available Jobs" count ignores coverage radius | ✅ Fixed |
| 3 | LOW | Locksmith Portal | `/locksmith/profile` URL hits dynamic `[id]` route → 500 | ✅ Fixed |
| 4 | INFO | Locksmith Portal | OpenStreetMap tiles fail on Settings coverage map | ⚠️ See notes |

---

## Bug #1 — SSE Notifications Abort (HIGH) ✅ Fixed

**Affected pages**: `/locksmith/jobs`, `/locksmith/earnings`  
**Symptom**: Console shows `[JobNotifications] Connection error: Event` and network tab shows `net::ERR_ABORTED` on every attempt to `GET /api/notifications/broadcast?locksmithId=...&stream=true`.

**Root cause** (two compounding issues):
1. **Vercel Hobby plan 10-second function timeout**: The SSE streaming response is a long-lived serverless function. Vercel Hobby kills it after 10 seconds, causing the immediate abort.
2. **Stateless in-memory Maps**: `locksmithConnections` and `locksmithNotificationStore` are module-level Maps inside `src/app/api/notifications/broadcast/route.ts`. Each Vercel serverless invocation is a fresh process with empty Maps. A POST to broadcast jobs goes to a different function instance than the GET SSE stream, so no connections are ever found in the Map — meaning notifications would silently drop even if the stream stayed open.

**Fix applied** (`src/hooks/useJobNotifications.ts`):
- Hook now tries SSE first (2 attempts)
- After 2 consecutive SSE failures, automatically switches to **30-second polling** via `GET /api/jobs?status=PENDING&availableForLocksmith=${locksmithId}`
- Polling diffs new job IDs against a known-set ref; fires `onNewJob` callback for genuinely new jobs
- Stops the infinite reconnect loop (was retrying every 5s forever)
- `isConnected` state accurately reflects the active channel (SSE or poll)

**Longer-term recommendation**: For true real-time notifications, replace the in-memory SSE system with [Pusher](https://pusher.com) or [Ably](https://ably.com) (both have generous free tiers). Alternatively, upgrade to Vercel Pro and migrate the broadcast route to Edge Runtime.

---

## Bug #2 — Dashboard Available Jobs Count Wrong (MEDIUM) ✅ Fixed

**Affected page**: `/locksmith/dashboard`  
**Symptom**: Dashboard stat card says "3 Available Jobs" but `/locksmith/jobs` page shows "0 Jobs Available" for the same locksmith.

**Root cause** (`src/app/locksmith/dashboard/page.tsx`):
- Dashboard fetched `GET /api/jobs` with **no filters** — returns every job in the entire system
- Then counted `status === "PENDING"` client-side — no geographic check
- `/locksmith/jobs` correctly uses `GET /api/jobs?status=PENDING&availableForLocksmith=${user.id}` which filters by the locksmith's coverage radius (Haversine distance calculation)
- Result: dashboard inflated the count by showing ALL pending jobs system-wide

**Fix applied** (`src/app/locksmith/dashboard/page.tsx`):
- Replaced single `fetch("/api/jobs")` with two targeted fetches:
  1. `GET /api/jobs?locksmithId=${user.id}` — for the locksmith's own assigned active/completed jobs
  2. `GET /api/jobs?status=PENDING&availableForLocksmith=${user.id}` — for the geographic available count
- Removed the now-redundant `job.locksmithId === user.id` client-side filter (handled by the API)
- Dashboard available count now matches the jobs page exactly

---

## Bug #3 — `/locksmith/profile` Returns 500 (LOW) ✅ Fixed

**Affected URL**: `https://www.locksafe.uk/locksmith/profile`  
**Symptom**: Page renders "Failed to fetch profile" error.

**Root cause**:
- No `src/app/locksmith/profile/page.tsx` exists
- The URL falls into the `src/app/locksmith/[id]/page.tsx` dynamic route with `id = "profile"`
- The layout bypass regex at `src/app/locksmith/layout.tsx:125` matches this URL (not excluded from public-profile bypass)
- The page fetches `GET /api/locksmiths/profile` which passed `"profile"` as a MongoDB ObjectId to Prisma
- Prisma throws `PrismaClientKnownRequestError` on the invalid ObjectId → API returns 500

**Fix applied** (`src/app/api/locksmiths/[id]/route.ts`):
- Added ObjectId format guard (`/^[0-9a-fA-F]{24}$/`) at the top of the GET handler
- Non-ObjectId IDs now return `{ success: false, error: "Locksmith not found" }` with HTTP 404
- Client component shows a clean "Locksmith not found" message instead of crashing

**Note**: There is no nav link to `/locksmith/profile` anywhere in the app. This URL would only be reached by typing it manually. The fix prevents a confusing 500 when this happens.

---

## Bug #4 — OpenStreetMap Tiles Failing on Settings Map (INFO)

**Affected page**: `/locksmith/settings` (coverage map section)  
**Symptom**: Tile requests to `a.tile.openstreetmap.org`, `b.tile.openstreetmap.org`, `c.tile.openstreetmap.org` fail. Some tiles show timestamp `1969-12-31` (Unix epoch 0), suggesting a date parsing issue in the tile URL builder.

**Root cause**: Not fully investigated. Likely one of:
- Browser privacy settings or extensions blocking third-party map tile requests
- Missing `referrerPolicy` on tile requests (OSM blocks certain referer combinations)
- Mapbox GL / Leaflet tile layer misconfiguration

**Impact**: Visual-only. The coverage area map on the Settings page shows a broken/grey tile background. The actual coverage circle and locksmith location marker still render correctly (they're vector overlays, not tiles). Locksmith can still set their coverage area — map functionality is intact.

**Recommendation**: Add an error handler for tile load failures and consider using Mapbox raster tiles (already have the Mapbox token `NEXT_PUBLIC_MAPBOX_TOKEN` configured) instead of OSM tiles.

---

## Confirmed Working ✅

### Admin Portal
| Page | Status |
|------|--------|
| Dashboard (`/admin`) | ✅ Passes |
| Jobs (`/admin/jobs`) | ✅ Passes |
| Locksmiths (`/admin/locksmiths`) | ✅ Passes |
| Customers/Payments (`/admin/customers`) | ✅ Passes |
| Teams/Companies (`/admin/locksmith-teams`) | ✅ Passes (autocomplete added) |
| Live Ops Map (`/admin/ops`) | ✅ Passes (build fix in commit `04cada6`) |
| Agents — 6/6 active (`/admin/agents`) | ✅ Passes |
| Voice Receptionist (`/admin/voice-receptionist`) | ✅ Passes |
| Marketing (`/admin/marketing`) | ✅ Passes |
| Ads (`/admin/ads`) | ✅ Passes |
| Analytics (`/admin/analytics`) | ✅ Passes |
| SEO (`/admin/seo`) | ✅ Passes |
| Security (`/admin/security`) | ✅ Passes |
| Refunds (`/admin/refunds`) | ✅ Passes |
| Disputes (`/admin/disputes`) | ✅ Passes |
| Emails (`/admin/emails`) | ✅ Passes |
| Organic (`/admin/organic`) | ✅ Passes |

### Locksmith Portal
| Page | Status |
|------|--------|
| Login | ✅ Passes (`amiosif@icloud.com / demo1234`) |
| Dashboard (`/locksmith/dashboard`) | ✅ Passes (count now fixed) |
| Available Jobs (`/locksmith/jobs`) | ✅ Passes (0 in coverage zone — correct) |
| Job History (`/locksmith/history`) | ✅ Passes |
| Earnings (`/locksmith/earnings`) | ✅ Passes |
| Settings (`/locksmith/settings`) | ✅ Passes (map tiles cosmetic issue) |
| My Team (`/locksmith/team`) | ✅ Passes |

### Customer Portal
| Page | Status |
|------|--------|
| Login (`/login`) | ✅ Passes (`customer@test.com / demo123`) |
| Dashboard (`/customer/dashboard`) | ✅ Passes |
| Settings (`/customer/settings`) | ✅ Passes |
| New Request flow (`/request`) | ✅ Passes — all 3 steps, creates real DB job |
| Job detail (`/customer/job/[id]`) | ✅ Passes |

### Public Pages
| Page | Status |
|------|--------|
| Home (`/`) | ✅ Passes |
| About (`/about`) | ✅ Passes |
| For Locksmiths (`/for-locksmiths`) | ✅ Passes |
| Locksmith Signup (`/locksmith-signup`) | ✅ Passes |
| How It Works (`/how-it-works`) | ✅ Passes |
| Pricing (`/pricing`) | ✅ Passes |
| Help (`/help`) | ✅ Passes |
| Blog (`/blog`) | ✅ Passes |
| Terms (`/terms`) | ✅ Passes |
| Forgot Password (`/forgot-password`) | ✅ Passes |
| SEO — postcode area (`/locksmith-area/wd3`) | ✅ Passes |
| SEO — city (`/locksmith-city/london`) | ✅ Passes |
| SEO — keyword (`/locksmith-rickmansworth`) | ✅ Passes |
| Intent index (`/intent`) | ✅ Passes |

### Expected 404s (by design — not bugs)
| URL | Reason |
|-----|--------|
| `/locksmith-area/london` | Slugs are postcodes (wd3, wd4 etc.), not city names |
| `/emergency-locksmith-london` | DB-driven keyword page not seeded in production |
| `/intent/locked-out` | DB-driven intent page not seeded in production |

---

## Test Credentials
- **Admin**: (via Vercel env — not stored here)  
- **Locksmith**: `amiosif@icloud.com / demo1234` (Alexandru Iosif, ID `69d94f89e27c2b3323d5a731`)  
- **Customer**: `customer@test.com / demo123`  

## Test Job Created During Audit
- **SW1-JOB110** — MongoDB ID `6a05736760df1b90f550daa5`  
  Status: `Finding Locksmiths`, Customer: `customer@test.com`, Postcode: `SW1A 1AA`  
  *(Created during customer flow testing — can be deleted from admin)*
