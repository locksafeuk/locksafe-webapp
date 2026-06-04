# LockSafe — Non-Indexed Pages SEO Audit

**Date:** 4 June 2026
**Source:** Google Search Console "Page indexing" coverage drilldown exports (3 files), property `locksafe.uk`
**Scope:** ~111 non-indexed URLs across 3 GSC issue buckets, audited against the live site and the Next.js codebase.

---

## Executive summary

There is **one root cause** behind the overwhelming majority of these non-indexed pages, and it is a single infrastructure misconfiguration — not a content problem.

**The host the site serves on contradicts the host every canonical tag declares.**

- Vercel has **`www.locksafe.uk` set as the primary domain**, so the apex `https://locksafe.uk/...` **301-redirects to `www`**.
- But the application — every canonical tag, the sitemap, `robots.txt`, and all OpenGraph URLs — declares the **apex** `https://locksafe.uk/...` as canonical (`NEXT_PUBLIC_SITE_URL=https://locksafe.uk`).

The result: each live `www` page returns 200 and tells Google "my canonical is the apex version," but the apex version immediately redirects back to `www`. Google cannot consolidate a cluster whose declared canonical is a redirecting URL, so it parks the `www` pages as *"Alternate page with proper canonical tag"* and never settles on an indexable canonical. This is suppressing indexation across the **entire programmatic local-SEO surface** (city, area, service, intent and postcode landing pages) — the site's main organic growth engine.

**Fix:** make the redirect direction agree with the canonical direction. Set the **apex (`locksafe.uk`) as the primary domain** in Vercel so `www` redirects to apex (and optionally enforce it in code). Everything else in the codebase already points to apex, so this one change aligns the whole system. Expected outcome: the ~100 "alternate" pages collapse into properly indexed apex URLs.

---

## What the data shows

The three exports are GSC coverage drilldowns, each for a different "Not indexed" reason:

| Bucket | GSC reason | URLs | Verdict |
|---|---|---:|---|
| 1 | Page with redirect | 2 | Expected — no action |
| 2 | Crawled – currently not indexed | 9 | Mostly non-content; **1 real page** needs attention |
| 3 | Alternate page with proper canonical tag | 101 | **Root-cause bucket — fix the host conflict** |

---

## Root-cause analysis (Bucket 3 — 101 URLs)

### Evidence

Live fetch of an affected page (`www`, returns 200):

```
GET https://www.locksafe.uk/locksmith-leeds/chapel-allerton   → 200 OK
    <link rel="canonical" href="https://locksafe.uk/locksmith-city/leeds/chapel-allerton">
```

Live fetch of that declared canonical (apex):

```
GET https://locksafe.uk/locksmith-city/leeds/chapel-allerton  → 301 → https://www.locksafe.uk/locksmith-city/leeds/chapel-allerton
    <link rel="canonical" href="https://locksafe.uk/locksmith-city/leeds/chapel-allerton">
```

Live fetch of the homepage:

```
GET https://locksafe.uk/   → 301 → https://www.locksafe.uk/
    <link rel="canonical" href="https://locksafe.uk">
```

So the canonical target **always redirects back to the page that points at it.** That is a self-defeating loop of signals.

### Two things are happening in each canonical (both intended except the host)

`/locksmith-leeds/chapel-allerton` → `/locksmith-city/leeds/chapel-allerton`:

1. **Path rewrite (intended):** `/locksmith-leeds/{area}` is a pretty SEO *alias* served by the `[keywordSlug]` catch-all route; it correctly canonicalizes to the real `/locksmith-city/{city}/{area}` structure. This part is working as designed — alias pages *should* be "alternates." There are several such alias families in the data: `locksmith-{city}/{area}`, `upvc-door-locksmith-near-me-in-{city}`, `24-hour-locksmith-near-me-in-{city}`, `lock-change-near-me-in-{city}`, `locksmith-near-me-in-{city}`, etc.
2. **Host switch (the bug):** `www` → apex. Because apex then redirects back to `www`, the canonical never resolves to a 200 page Google can index.

The homepage appearing in this bucket is the clearest tell: `www` homepage canonicals to apex homepage, apex homepage 301s to `www`. A site's own homepage should never be an "alternate."

### Why the codebase confirms apex is the intended canonical

| Signal | Value | File |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` (prod) | `https://locksafe.uk` (apex) | `.env.vercel.prod` |
| `siteConfig.url` / `SITE_URL` | apex | `src/lib/config.ts` |
| `canonical()` helper | `getFullUrl()` → apex | `src/lib/seo/url-helpers.ts` |
| All page canonicals & OG URLs | apex | `src/app/**/page.tsx` |
| Sitemap base URL | apex | `src/app/sitemap.ts` |
| `robots.txt` sitemap line | apex | `src/app/robots.ts` |
| Host redirect in code | **none** (only legacy Shopify redirects) | `next.config.js` / no middleware / `vercel.json` |

Because there is **no host redirect in the code**, the apex→www 301 is coming from the **Vercel project domain settings** (www is currently the primary domain). That is the single lever to flip.

---

## Bucket-by-bucket breakdown

### Bucket 1 — "Page with redirect" (2 URLs) — ✅ no action
```
http://www.locksafe.uk/
http://locksafe.uk/
```
These are the insecure `http://` homepages redirecting to `https://`. Normal and correct. Google lists them only to explain why the `http` variants aren't indexed.

### Bucket 2 — "Crawled – currently not indexed" (9 URLs)

| URL | Type | Action |
|---|---|---|
| `/_next/static/chunks/09eiix4-3~6z8.js` | JS asset | Ignore — not indexable content |
| `/_next/static/chunks/0ncy15k_qdx0-.js` | JS asset | Ignore |
| `/opengraph-image`, `/twitter-image` | Image-gen route | Already `Disallow`-ed in `robots.ts` — will drop off |
| `/locksmith-signup/opengraph-image`, `/locksmith-signup/twitter-image` | Image-gen route | Already `Disallow`-ed (`/**/opengraph-image`) — will drop off |
| `/manifest.json` | PWA manifest | Already `Disallow`-ed — will drop off |
| `/privacy` | Thin legal page | Low priority; acceptable to remain unindexed |
| **`/emergency-locksmith-wd7-radlett`** | **Real money page (postcode landing)** | **Attention — see below** |

The only genuine concern here is **`/emergency-locksmith-wd7-radlett`**. It's a real revenue page that Google crawled and chose not to index. It is almost certainly a *second symptom of the same host conflict* (apex crawl → 301 → www → canonical back to apex), compounded by being a relatively new/thin postcode page. Fixing the host issue should let it index; if it still doesn't after re-crawl, strengthen it (see P2).

### Bucket 3 — "Alternate page with proper canonical tag" (101 URLs) — 🔴 root-cause bucket
All 101 are on the **`www`** host and span the full programmatic surface: `locksmith-city/{city}/{area}`, `services/{service}/in/{city}`, `intent/{slug}/in/{city}`, `emergency-locksmith-{postcode}` (+ sub-services), and the alias families. These are non-indexed because their declared apex canonical redirects. **Resolved by the P0 fix.** The full list is in the appendix.

---

## Prioritised remediation plan

### P0 — Align host: make apex the primary domain (fixes ~100 pages)
The whole codebase treats apex as canonical, so flip the infrastructure to match.

1. **Vercel → Project → Settings → Domains:** set **`locksafe.uk` as the Primary domain** and configure **`www.locksafe.uk` to redirect to it** (Vercel offers a "Redirect to locksafe.uk" toggle on the `www` domain). This makes `www` 301→apex and apex serve 200.
2. **(Recommended belt-and-braces) enforce in code** so it can't silently regress, by adding a host redirect to `next.config.js`:

```js
async redirects() {
  return [
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'www.locksafe.uk' }],
      destination: 'https://locksafe.uk/:path*',
      permanent: true,
    },
    // ...existing legacy Shopify redirects
  ];
}
```

After deploy, verify: `https://www.locksafe.uk/...` → 301 → `https://locksafe.uk/...` (200), and apex pages serve 200 with a self-referencing canonical.

### P1 — Reinforce the corrected canonical to Google
- Confirm `sitemap.xml` lists **apex** URLs only (it already does) and resubmit it in GSC.
- In GSC, use **URL Inspection → Request indexing** on the homepage and a handful of representative apex pages (one per template) to prompt re-crawl.
- Spot-check internal links render against apex after the redirect flips (Next.js `<Link>` uses relative hrefs, so they'll resolve to apex automatically once apex is primary — no code change expected).

### P2 — Re-evaluate the one real "crawled–not-indexed" page
After the host fix and re-crawl, recheck **`/emergency-locksmith-wd7-radlett`**. If still unindexed, it's a content-quality signal: ensure it has unique local copy (not just templated boilerplate), genuine internal links pointing **to** it from related city/area pages, and an entry in the sitemap. The same applies to any thin postcode page.

### P3 — Confirm the non-content URLs drop out
The image-generation endpoints and `manifest.json` are already disallowed in `robots.ts`, so they'll fall out of the report on the next crawl. No further action — just confirm in a few weeks.

---

## Verification checklist (after deploying P0)

- [ ] `curl -I https://www.locksafe.uk/` returns `301` → `https://locksafe.uk/`
- [ ] `curl -I https://locksafe.uk/` returns `200` (no redirect)
- [ ] A location page (e.g. `/locksmith-city/leeds/chapel-allerton`) serves `200` on apex with `canonical = https://locksafe.uk/locksmith-city/leeds/chapel-allerton` (self-referencing, no redirect)
- [ ] `https://locksafe.uk/sitemap.xml` lists apex URLs and returns `200`
- [ ] GSC "Alternate page with proper canonical tag" count trends down over 2–4 weeks as pages migrate to "Indexed"
- [ ] `/emergency-locksmith-wd7-radlett` re-crawled and indexed (or queued for P2)

---

## Appendix — full URL lists by bucket

### Bucket 1 — Page with redirect (2)
```
http://www.locksafe.uk/
http://locksafe.uk/
```

### Bucket 2 — Crawled – currently not indexed (9)
```
https://www.locksafe.uk/_next/static/chunks/09eiix4-3~6z8.js
https://www.locksafe.uk/_next/static/chunks/0ncy15k_qdx0-.js
https://locksafe.uk/privacy
https://locksafe.uk/emergency-locksmith-wd7-radlett   ← real page, needs attention
https://locksafe.uk/locksmith-signup/opengraph-image
https://locksafe.uk/locksmith-signup/twitter-image
https://locksafe.uk/opengraph-image
https://locksafe.uk/twitter-image
https://www.locksafe.uk/manifest.json
```

### Bucket 3 — Alternate page with proper canonical tag (101, all `www`)
```
https://www.locksafe.uk/   (homepage)
https://www.locksafe.uk/services/safe-opening/in/norwich
https://www.locksafe.uk/locksmith-leeds/chapel-allerton
https://www.locksafe.uk/services/burglary-lock-repair/in/stoke-on-trent
https://www.locksafe.uk/locksmith-nottingham/lenton
https://www.locksafe.uk/intent/key-snapped-in-lock/in/london
https://www.locksafe.uk/upvc-door-locksmith-near-me-in-sheffield
https://www.locksafe.uk/upvc-door-locksmith-near-me-in-cambridge
https://www.locksafe.uk/locksmith-preston/bamber-bridge
https://www.locksafe.uk/locksmith-canterbury/thanington
https://www.locksafe.uk/emergency-locksmith-w-west-london
https://www.locksafe.uk/emergency-locksmith-sw-south-west-london/lock-change
https://www.locksafe.uk/emergency-locksmith-wd3-rickmansworth
https://www.locksafe.uk/24-hour-locksmith-near-me-in-dundee
https://www.locksafe.uk/24-hour-locksmith-near-me-in-edinburgh
https://www.locksafe.uk/emergency-locksmith-bs-bristol/emergency-locksmith
https://www.locksafe.uk/locked-out-locksmith-near-me-in-canterbury
https://www.locksafe.uk/emergency-locksmith-en-enfield/commercial-locksmith
https://www.locksafe.uk/locksmith-bradford/ilkley
https://www.locksafe.uk/locksmith-near-me-in-sheffield
https://www.locksafe.uk/locksmith-worthing/lancing
https://www.locksafe.uk/emergency-locksmith-cm-chelmsford/commercial-locksmith
https://www.locksafe.uk/locksmith-wolverhampton/city-centre
https://www.locksafe.uk/locksmith-doncaster/edenthorpe
https://www.locksafe.uk/locksmith-middlesbrough/redcar
https://www.locksafe.uk/auto-locksmith-near-me-in-cheltenham
https://www.locksafe.uk/services/burglary-lock-repair/in/portsmouth
https://www.locksafe.uk/mobile-locksmith-near-me-in-wolverhampton
https://www.locksafe.uk/locksmith-bolton/halliwell
https://www.locksafe.uk/services/car-key-replacement/in/salisbury
https://www.locksafe.uk/services/lock-change/in/plymouth
https://www.locksafe.uk/locksmith-belfast/city-centre
https://www.locksafe.uk/services/car-key-replacement/in/eastbourne
https://www.locksafe.uk/intent/moving-in-change-locks/in/colchester
https://www.locksafe.uk/intent/moving-in-change-locks/in/cheltenham
https://www.locksafe.uk/lock-change-near-me-in-leeds
https://www.locksafe.uk/locksmith-warrington/lymm
https://www.locksafe.uk/emergency-locksmith-ba-bath/lock-change
https://www.locksafe.uk/intent/key-snapped-in-lock/in/plymouth
https://www.locksafe.uk/services/commercial-locksmith/in/wakefield
https://www.locksafe.uk/lock-change-near-me-in-london
https://www.locksafe.uk/24-hour-locksmith-near-me-in-poole
https://www.locksafe.uk/car-locksmith-near-me-in-poole
https://www.locksafe.uk/services/car-key-replacement/in/warrington
https://www.locksafe.uk/locksmith-eastbourne/old-town
https://www.locksafe.uk/services/landlord-lock-change/in/newport
https://www.locksafe.uk/locksmith-ipswich/martlesham
https://www.locksafe.uk/services/car-key-replacement/in/ipswich
https://www.locksafe.uk/intent/moving-in-change-locks/in/warrington
https://www.locksafe.uk/emergency-locksmith-s-sheffield/commercial-locksmith
https://www.locksafe.uk/emergency-locksmith-sg-stevenage/commercial-locksmith
https://www.locksafe.uk/intent/office-lockout/in/halifax
https://www.locksafe.uk/locksmith-gloucester/quedgeley
https://www.locksafe.uk/intent/locked-out-at-night/in/cardiff
https://www.locksafe.uk/services/landlord-lock-change/in/blackpool
https://www.locksafe.uk/locksmith-middlesbrough/linthorpe
https://www.locksafe.uk/lock-change-near-me-in-bolton
https://www.locksafe.uk/locksmith-southampton/city-centre
https://www.locksafe.uk/services/upvc-door-lock-repair/in/belfast
https://www.locksafe.uk/locksmith-near-me-in-canterbury
https://www.locksafe.uk/24-hour-locksmith-near-me-in-coventry
https://www.locksafe.uk/services/upvc-door-lock-repair/in/southampton
https://www.locksafe.uk/services/burglary-lock-repair/in/huddersfield
https://www.locksafe.uk/emergency-locksmith-w-west-london/commercial-locksmith
https://www.locksafe.uk/services/burglary-lock-repair/in/carlisle
https://www.locksafe.uk/intent/office-lockout/in/bradford
https://www.locksafe.uk/services/safe-opening/in/wakefield
https://www.locksafe.uk/auto-locksmith-near-me-in-leeds
https://www.locksafe.uk/lock-change-near-me-in-canterbury
https://www.locksafe.uk/lock-change-near-me-in-aberdeen
https://www.locksafe.uk/auto-locksmith-near-me-in-luton
https://www.locksafe.uk/locksmith-milton-keynes/bletchley
https://www.locksafe.uk/upvc-door-locksmith-near-me-in-gloucester
https://www.locksafe.uk/locksmith-stevenage/town-centre
https://www.locksafe.uk/services/lock-change/in/maidstone
https://www.locksafe.uk/intent/key-snapped-in-lock/in/leicester
https://www.locksafe.uk/services/burglary-lock-repair/in/watford
https://www.locksafe.uk/locksmith-near-me-in-newcastle
https://www.locksafe.uk/emergency-locksmith-hr-hereford/commercial-locksmith
https://www.locksafe.uk/locked-out-locksmith-near-me-in-northampton
https://www.locksafe.uk/services/safe-opening/in/newport
https://www.locksafe.uk/services/locked-out/in/swansea
https://www.locksafe.uk/mobile-locksmith-near-me-in-lancaster
https://www.locksafe.uk/locked-out-locksmith-near-me-in-blackpool
https://www.locksafe.uk/services/car-key-replacement/in/sunderland
https://www.locksafe.uk/services/burglary-lock-repair/in/chelmsford
https://www.locksafe.uk/locksmith-birmingham/selly-oak
https://www.locksafe.uk/emergency-locksmith-wd25-garston-leavesden/lock-change
https://www.locksafe.uk/24-hour-locksmith-near-me-in-inverness
https://www.locksafe.uk/lock-change-near-me-in-lancaster
https://www.locksafe.uk/lock-change-near-me-in-middlesbrough
https://www.locksafe.uk/services/emergency-locksmith/in/liverpool
https://www.locksafe.uk/locksmith-near-me-in-stevenage
https://www.locksafe.uk/emergency-locksmith-ln-lincoln
https://www.locksafe.uk/emergency-locksmith-al2-st-albans-south
https://www.locksafe.uk/blog/category/home-security
https://www.locksafe.uk/locksmith-rickmansworth
https://www.locksafe.uk/emergency-locksmith-eh-edinburgh
https://www.locksafe.uk/emergency-locksmith-wd17-watford-centre
https://www.locksafe.uk/locksmith-lancaster
https://www.locksafe.uk/emergency-locksmith-gu-guildford
https://www.locksafe.uk/emergency-locksmith-wd7-radlett
```
