# Canary Campaign Spec — Variant D, Workstream 1

**Purpose:** prove the full funnel end-to-end (impression → click → landing → booking → Stripe paid → conversion recorded in Google Ads) on ONE coherent campaign, before scaling. This is a *funnel-validation* canary, not a growth play — keep it simple so that if something's still broken, it's obvious where.

**Hard prerequisite (the gate):** `GOOGLE_ADS_CONVERSION_ACTION_RESOURCE` set to `customers/4715226378/conversionActions/7624512129` in Vercel prod + redeployed + verified non-empty via `vercel env pull`. Do not build/enable this campaign until that's confirmed. Everything below is staged behind that gate.

---

## 0. Why single-town, not multi-town

The canary's job is to answer one question: *does a conversion actually get recorded?* Adding multiple towns/ad groups multiplies variables and makes a null result ambiguous. Get ONE town serving + converting, then expand to the consolidated multi-town structure (that's a later step, with the fixed generator). One campaign, one ad group, one town.

---

## 1. Town selection — LOCKED: Liverpool

**Town: Liverpool (district L1 → `/locksmith-in/l1`).**
Chosen by data: the coverage-density report ranked Liverpool as the **densest active coverage outside London — 4 active locksmiths** blanketing the L-postcodes (L1, L2, L3, L5, L7, L8, L15, L17, L18, L19, L69, L70, L74) + Wirral/Cheshire (CH25, CH32). No other area hit 4. The `/locksmith-in/l1` page was generated locally (via `scripts/generate-district.ts L1`) and is live — verified: anchor "Liverpool", real coverage facts (4 engineers, 10-mi radius, ~15-min arrival), nearby outcodes L3/L2/L74/L70/CH25, district-specific FAQs, grammar fix applied.

**Why coverage density is the selector:** the canary succeeds only if a click becomes a *completed, paid* job. 4 overlapping locksmiths = redundancy = highest chance a job is accepted fast and fulfilled = conversion fires. Also de-risks the "one locksmith on holiday kills the canary" failure mode. London excluded (most expensive/competitive CPCs — bad place to validate a funnel cheaply).

**Pre-launch content check (one item):** confirm the `[year implied by operation]` LLM placeholder artifact in the L1 page's "Why choose us" paragraph has been removed (being fixed manually). A visible bracketed placeholder on a page taking paid traffic looks broken.

**Fallback if Liverpool coverage turns out unreliable in practice:** Manchester (M1 → `/locksmith-in/m1`, page already exists). Swap by replacing "liverpool"/"Liverpool" and `/locksmith-in/l1` throughout.

---

## 2. Campaign settings

| Setting | Value | Why |
|---|---|---|
| Type | Search | Only Search; no Display/Partners |
| Networks | Google Search only — **uncheck Search Partners, uncheck Display** | Partners/Display dilute intent + waste budget on a canary |
| Bid strategy | **Manual CPC** (NOT Maximize Conversions) | Zero conversion history = Smart Bidding has nothing to model. Manual CPC caps per-click cost. Switch to conversion bidding only after ~15-30 recorded conversions. |
| Max CPC | **£8.00** ceiling | UK emergency-locksmith CPCs run £6-15; £8 cap prevents one click eating the day's budget |
| Daily budget | **£20/day** | ~7-day window = ~£140 max exposure. High CPC means this buys ~2-4 clicks/day — enough to validate the funnel, small enough to be safe |
| Location | **Manchester** + 8-mile radius (or city target "Manchester, England") | Aligned with the town keyword. Coverage-gated: only run if an active Manchester locksmith exists |
| Location options | **"Presence: People in or regularly in your targeted locations"** (NOT "presence or interest") | Stops showing to people merely *searching about* Manchester from elsewhere |
| Language | English | |
| Ad schedule | All hours (24/7) | Emergency intent is round-the-clock; that's the differentiator |
| Start state | Build PAUSED, then enable all 3 levels (campaign → ad group → ad) deliberately once reviewed | The publish-flow lesson: nothing serves until all three are enabled |

---

## 3. Ad group (one)

**Name:** `Liverpool — Emergency`

**Keywords** (town-name based, NOT outcode — this is the core fix):

EXACT (highest intent, controlled spend):
```
[emergency locksmith liverpool]
[24 hour locksmith liverpool]
[locksmith liverpool]
[locked out liverpool]
```

PHRASE (catch natural variations + the highest-volume "near me" from in-geo users):
```
"emergency locksmith liverpool"
"24 hour locksmith liverpool"
"locksmith near me"
"emergency locksmith near me"
"locked out locksmith"
```

That's 9 keywords — deliberately tight and high-intent, every one mapping to "someone in Liverpool who needs a locksmith now." Note `locksmith near me` is included as a positive; with presence-based Liverpool geo-targeting, a "near me" search from a Liverpool user IS our customer.

**Do NOT add these as negatives** (the bug we found): `near me`, bare `free`, bare `how to`. They block the positives above.

---

## 4. Negative keywords (cleaned)

Add at campaign level. This is the safe subset of the baseline — multi-word, specific, no collateral damage to valid commercial queries:

```
locksmith job
locksmith jobs
locksmith course
locksmith training
locksmith apprenticeship
locksmith salary
how to pick a lock
how to become a locksmith
lock pick set
lock picking
diy lock change
car locksmith
auto locksmith
car key replacement
safe opening
key cutting
spare key
padlock
bike lock
cheap locksmith
free locksmith quote
locksmith review
locksmith scam
master locksmiths association
checkatrade
```

**Explicitly removed vs. the old 28-list:** bare `free` (blocked "free callout"), bare `how to` (blocked "how much to change a lock"), bare `near me` (blocked "locksmith near me"), bare `kit`. Replaced with their safe multi-word forms where the intent is genuinely junk (`free locksmith quote`, `how to pick a lock`).

---

## 5. Responsive Search Ad

**Final URL:** `https://www.locksafe.uk/locksmith-in/l1`
**Display path:** `locksafe.uk/Liverpool/Locksmith`

**Headlines (15)** — lead with speed + fixed price (the emergency-intent levers), support with trust. Keep "Liverpool" in several for keyword↔ad alignment (quality score):
```
1.  Emergency Locksmith Liverpool
2.  Locksmith Liverpool — 24/7
3.  Locked Out? Call Now
4.  Fixed Price Before We Start
5.  No Callout Fee, Ever
6.  DBS-Checked Local Engineer
7.  Real Local Locksmith, Not a Call-Centre
8.  Liverpool Locksmith Near You
9.  Insured & Vetted Engineers
10. Price Agreed Up Front
11. Fast Response Across Liverpool
12. 24 Hour Emergency Locksmith
13. Locked Out of Your Home?
14. Transparent Pricing, No Surprises
15. Trusted Liverpool Locksmith
```
*(Pin Headline 1 or 2 to Position 1 so the town always shows.)*

**Descriptions (4):**
```
1.  Locked out in Liverpool? DBS-checked local engineer, fixed price agreed before any work starts. No callout fee.
2.  Real local locksmith — not a national call-centre. Insured, vetted, transparent pricing. Call for a fast response.
3.  24/7 emergency locksmith covering Liverpool. We confirm the exact cost before starting. No hidden fees.
4.  Tired of dodgy quotes? Honest, fixed-price locksmith service. DBS-checked engineers, fully insured.
```

**On the trust/anti-fraud question you raised:** keep trust signals (DBS-checked, fixed price, no callout fee) as *support*, not the lead. For emergency intent, speed + price certainty drive CTR; trust differentiates you from scam locksmiths but shouldn't be the headline. I dropped explicit "anti-fraud"/"anti-scam" framing from the ad — it reads defensive and can lower CTR vs. a direct "fixed price, no callout fee" promise. Test that hypothesis later with an ad variant.

**Assets to add (free CTR lift):**
- Call asset: +44 20 4577 1989 (the LockSafe line)
- Sitelinks: "Book Online", "How Pricing Works", "Areas We Cover", "About LockSafe"
- Callouts: "Fixed Price", "No Callout Fee", "DBS-Checked", "24/7 Dispatch" — *(avoid "DBS Check" as a bare callout; it tripped the Government Documents policy. "DBS-Checked Engineers" is safe.)*

---

## 6. Pre-launch checklist (all must be ✓ before enabling)

1. ☐ `GOOGLE_ADS_CONVERSION_ACTION_RESOURCE` = `customers/4715226378/conversionActions/7624512129` in Vercel prod, redeployed, verified non-empty
2. ☑ `/locksmith-in/l1` returns HTTP 200 and copy reads clean (verified; `[year]` placeholder removed, region fix pending)
3. ☐ "LockSafe Job Completed" is the only Primary conversion action (already confirmed)
4. ☐ gclid is captured on the landing page and persists to the Job (the `CallIntent`/attribution loop) — verify with one manual test click carrying a `?gclid=test` param
5. ☐ Active, reliable Manchester locksmith coverage exists (the job must be fulfillable + paid for the conversion to ever fire)
6. ☐ Billing/payment method valid on the Google Ads account

---

## 7. The end-to-end test (the real proof)

Before trusting the campaign to spend, validate the conversion path manually:
1. Visit `https://www.locksafe.uk/locksmith-in/m1?gclid=TEST_CANARY_001`
2. Complete a real (or staged) booking through to Stripe payment
3. Confirm the `Job` row records `gclid` (or the CallIntent matcher supplies it) and `conversionUploadStatus` flips to `"uploaded"`
4. Within a few hours, the conversion-action detail page's red "not receiving data" banner clears and shows 1 conversion
5. Only then is the funnel proven

---

## 8. Then: 7-day no-touch

Once enabled with the test passed, **do not change keywords, negatives, geo, budget, or bid for 7 days.** Every edit resets Manual CPC's (limited) learning and muddies the read. The auto-pause warmup guard (14 days) already protects it from the cron. Watch via the health dashboard + morning briefing only — observe, don't touch.

---

## 9. Expansion path (after canary proves out)

Once Manchester records conversions cleanly:
- Add Leeds + Reading as **new ad groups in the same campaign** (pooled budget), each with town-name keywords → its own `/locksmith-in/{district}` page
- Raise budget to ~£50/day pooled
- Once the campaign clears ~15-30 conversions/month, switch bid strategy to Maximize Conversions / Target CPA
- Fix `discovery-campaign-generator` (Workstream 2) so future auto-generated campaigns use town-name keywords + cleaned negatives + this structure — then the pipeline scales it across all coverage

---

## Open decisions for you
1. **Town**: Manchester (recommended) or override based on best coverage?
2. **Budget**: £20/day canary, or lower/higher given your appetite?
3. **Who builds**: I drive it via Chrome, or you build from this sheet and I verify?
