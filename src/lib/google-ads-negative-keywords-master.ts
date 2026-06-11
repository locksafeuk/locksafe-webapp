/**
 * LockSafe Master Negative Keyword List — UK Locksmith Dispatch
 * ──────────────────────────────────────────────────────────────
 *
 * Bulletproof negative keyword vocabulary for every LockSafe Google Ads
 * Search campaign. Designed to block the categories of search-term
 * waste we have empirically observed (and the categories every reputable
 * locksmith PPC playbook warns about), without over-restricting the
 * actual emergency / booking intent we want to capture.
 *
 * Built 2026-06-10 after the 51-clicks-£337-0-conversions investigation.
 * Sources cross-referenced:
 *   - Our own diag-search-terms output (the 11 queries that wasted spend
 *     in the last 7 days — every single one fell into one of the
 *     categories below)
 *   - groas.com 300+ Google Ads Negative Keywords 2026
 *     (https://www.groas.com/post/google-ads-negative-keywords-list-2026-comprehensive-guide-by-category-industry)
 *   - SwiftLead — Google Ads for Locksmiths UK
 *     (https://swiftlead.co.uk/blog/google-ads-for-locksmiths)
 *   - BlueGrid Media — Google Ads for Locksmiths 2026
 *     (https://bluegridmedia.com/google-ads-for-locksmiths)
 *   - WebFX — PPC for Locksmiths
 *     (https://www.webfx.com/blog/home-services/locksmith-advertising-guide/)
 *   - Locksmith Marketing — Google Ads Blueprint for Locksmiths
 *     (https://www.locksmithwebsites.com/blog/the-google-ads-blueprint-for-locksmiths-how-to-get-more-calls-without-wasting-money)
 *   - LockPickingLawyer Wikipedia + locksport YouTube channel research
 *
 * Match type strategy
 * ───────────────────
 * Default match type = PHRASE.
 *   - PHRASE blocks the exact phrase (in order) anywhere in the query
 *   - Won't kill close variants where word order changes (intentional —
 *     leaves headroom for legitimate intent permutations)
 * Specific exceptions are marked with `matchType: "BROAD"` (block any
 * query containing all the words) or `matchType: "EXACT"` (block only
 * that exact query).
 *
 * What we DO NOT block (deliberate, against the simpler advice in some
 * guides):
 *   - "near me" — fundamental to local-service intent
 *   - "cheap" — price-sensitive emergency callers still convert
 *   - "review(s)" — even research-mode searchers may convert later
 *   - "best" — same reason
 *   - "quote" — high intent: people who want a quote will call
 *   - "emergency" — obviously stay
 *   - Specific UK city / county / postcode names — geo is handled by
 *     PRESENCE targeting, not by negative keywords
 *
 * What we DO block (with rationale embedded per category):
 *   - Price-research intent (how much / cost / price …)
 *   - DIY / how-to / tutorial intent (how to / yourself / youtube …)
 *   - Spare-parts and DIY retailer searches (parts / spares / Screwfix
 *     / B&Q / Argos / Wickes …)
 *   - Job seekers / training (salary / apprenticeship / course …)
 *   - Lock picking / hobby / locksport (lockpick / bump key /
 *     LockPickingLawyer …)
 *   - Smart-lock product research (yale smart lock / yale conexis …)
 *   - Wrong-geo / non-UK (NYC / brooklyn / florida …)
 *   - Wrong-service (padlock / bike lock / safe / gun safe …) where
 *     LockSafe does not currently dispatch
 *   - Adult / off-topic / pop culture (porn / lyrics / fortnite …)
 *   - Free / discount seekers (free / freebie / voucher …)
 *   - Insurance / legal claim adjacency
 *   - Locksmith name disambiguation (Locksmith rapper / wikipedia)
 *
 * Maintenance
 * ───────────
 * The cron at `/api/cron/google-ads-search-terms-review` (built
 * separately) inspects the search-terms report weekly and proposes
 * additions. Approved additions append to MASTER below; the upload
 * endpoint re-syncs the shared list.
 */

export interface NegativeKeyword {
  text: string;
  matchType: "PHRASE" | "BROAD" | "EXACT";
}

/** Helper — most entries are phrase-match. */
const P = (text: string): NegativeKeyword => ({ text, matchType: "PHRASE" });
/** Broad — every word must appear, order doesn't matter. */
const B = (text: string): NegativeKeyword => ({ text, matchType: "BROAD" });
/** Exact — only this precise query. */
const E = (text: string): NegativeKeyword => ({ text, matchType: "EXACT" });

/** Category 1 — Price / cost research intent.
 *  Captured 5 of 11 wasted clicks in our 7-day search-terms diag. */
const PRICE_RESEARCH: NegativeKeyword[] = [
  P("how much"),
  P("how much for"),
  P("how much does"),
  P("how much do"),
  P("how much is"),
  P("how much to"),
  P("how much should"),
  P("how much would"),
  P("how much will"),
  P("cost"),
  P("costs"),
  P("how much cost"),
  P("price"),
  P("prices"),
  P("pricing"),
  P("price list"),
  P("price guide"),
  P("rates"),
  P("rate"),
  P("price comparison"),
  P("compare prices"),
  P("price range"),
  P("average cost"),
  P("typical cost"),
  P("typical price"),
  P("estimate"),
  P("estimates"),
  P("get estimate"),
  P("ballpark"),
  P("uk average"),
];

/** Category 2 — DIY / How-to / Tutorial intent.
 *  Captured 4 of 11 wasted clicks (the "how to change locks", "changing
 *  locks on door" set). */
const DIY_HOWTO: NegativeKeyword[] = [
  P("how to"),
  P("how do you"),
  P("how do i"),
  P("can i"),
  P("tutorial"),
  P("tutorials"),
  P("guide"),
  P("guide to"),
  P("step by step"),
  P("instructions"),
  P("walkthrough"),
  P("walk through"),
  P("diy"),
  P("d.i.y"),
  P("do it yourself"),
  P("yourself"),
  P("by yourself"),
  P("on your own"),
  P("youtube"),
  P("video"),
  P("videos"),
  P("watch"),
  P("youtube video"),
  P("learn"),
  P("learning"),
  P("teach"),
  P("teach me"),
  P("teach yourself"),
  P("self taught"),
  P("hack"),
  P("trick"),
  P("tricks"),
  P("life hack"),
  P("tips"),
  P("tips and tricks"),
  P("explained"),
  P("explanation"),
  P("what is"),
  P("what are"),
  P("what does"),
  P("definition"),
  P("define"),
  P("meaning"),
  P("wiki"),
  P("wikipedia"),
];

/** Category 3 — Parts, spares, DIY retailers (UK).
 *  Captured 2 of 11 wasted clicks ("upvc door lock spares" and
 *  "cost to replace upvc door lock mechanism near me"). */
const PARTS_SPARES_RETAILERS: NegativeKeyword[] = [
  P("spares"),
  P("spare"),
  P("spare parts"),
  P("parts"),
  P("part"),
  P("replacement parts"),
  P("replacement part"),
  P("mechanism"),
  P("mechanisms"),
  P("door mechanism"),
  P("lock mechanism"),
  P("kit"),
  P("kits"),
  P("supplies"),
  P("supply"),
  P("supplier"),
  P("suppliers"),
  P("wholesale"),
  P("wholesalers"),
  P("manufacturer"),
  P("manufacturers"),
  P("factory"),
  P("dropship"),
  P("dropshipping"),
  P("trade only"),
  P("trade prices"),
  P("buy"),
  P("for sale"),
  P("shop"),
  P("store"),
  P("shop online"),
  P("online store"),
  P("buy online"),
  P("order online"),
  // UK retailers
  P("b&q"),
  P("b and q"),
  P("bandq"),
  P("wickes"),
  P("screwfix"),
  P("toolstation"),
  P("homebase"),
  P("argos"),
  P("john lewis"),
  P("ikea"),
  P("amazon"),
  P("ebay"),
  P("etsy"),
  P("aliexpress"),
  P("alibaba"),
  P("wayfair"),
  P("manomano"),
  P("tradepoint"),
  P("halfords"),
  P("currys"),
  P("selco"),
  P("ao"),
  P("ao.com"),
  P("dunelm"),
  P("range"),
  P("hobbycraft"),
  P("the range"),
  // Locksmith-supply specifics
  P("souber"),
  P("locksmith supplies"),
  P("locksmith supplier"),
];

/** Category 4 — Lock picking / Locksport / Hobby / YouTube creators.
 *  Burns budget on people who never want a service — they want to
 *  watch a lock get picked. */
const LOCKPICKING_HOBBY: NegativeKeyword[] = [
  P("lock pick"),
  P("lockpick"),
  P("lock picking"),
  P("lockpicking"),
  P("pick a lock"),
  P("pick lock"),
  P("picking a lock"),
  P("how to pick"),
  P("picked"),
  P("picking"),
  P("pick set"),
  P("lockpick set"),
  P("lock pick set"),
  P("bump key"),
  P("bump keys"),
  P("bumping"),
  P("bumping a lock"),
  P("snap"),
  P("snapping"),
  P("snap gun"),
  P("snapping lock"),
  P("bypass"),
  P("bypass tool"),
  P("locksport"),
  P("lock sport"),
  P("locksmithing hobby"),
  P("hobby"),
  P("hobbyist"),
  P("lockpickinglawyer"),
  P("lock picking lawyer"),
  P("bosnianbill"),
  P("bosnian bill"),
  P("deviant ollam"),
  P("helpful lock picker"),
  P("mr locksmith"),
  P("asmr"),
  P("satisfying"),
  P("oddly satisfying"),
  P("compilation"),
  P("game"),
  P("video game"),
  P("simulator"),
  P("lockpicking simulator"),
  P("lock pick game"),
  P("fallout"),
  P("skyrim"),
  P("ghost recon"),
  P("hitman"),
  P("dishonored"),
  P("minecraft"),
  P("roblox"),
  P("fortnite"),
];

/** Category 5 — Jobs / careers / training / apprenticeships.
 *  Job-seekers searching "locksmith jobs" or "become a locksmith"
 *  trigger our keywords easily under phrase match. */
const JOBS_TRAINING: NegativeKeyword[] = [
  P("jobs"),
  P("job"),
  P("career"),
  P("careers"),
  P("vacancy"),
  P("vacancies"),
  P("hiring"),
  P("hire me"),
  P("recruitment"),
  P("recruiter"),
  P("recruit"),
  P("recruiting"),
  P("employment"),
  P("salary"),
  P("salaries"),
  P("wage"),
  P("wages"),
  P("pay"),
  P("payscale"),
  P("how much earn"),
  P("how much do they earn"),
  P("how much do they make"),
  P("cv"),
  P("resume"),
  P("cover letter"),
  P("interview"),
  P("interview questions"),
  P("job description"),
  P("indeed"),
  P("totaljobs"),
  P("reed"),
  P("reed.co.uk"),
  P("monster"),
  P("glassdoor"),
  P("gumtree job"),
  P("linkedin job"),
  P("apprentice"),
  P("apprenticeship"),
  P("intern"),
  P("internship"),
  P("training"),
  P("training course"),
  P("course"),
  P("courses"),
  P("classes"),
  P("school"),
  P("college"),
  P("university"),
  P("academy"),
  P("learn locksmith"),
  P("become a locksmith"),
  P("become locksmith"),
  P("becoming a locksmith"),
  P("how to become"),
  P("starting out"),
  P("start a business"),
  P("how to start"),
  P("qualification"),
  P("qualifications"),
  P("qualified"),
  P("certification"),
  P("certificate"),
  P("certified"),
  P("certify"),
  P("exam"),
  P("nvq"),
  P("city and guilds"),
  P("city & guilds"),
  P("ncfe"),
  P("btec"),
  P("gcse"),
  P("a level"),
  P("a-level"),
  P("mla membership"),
  P("master locksmiths association"),
  P("study"),
  P("studying"),
  P("study material"),
  P("test prep"),
  P("study guide"),
  P("training jobs"),
];

/** Category 6 — Smart lock / product research.
 *  "yale smart lock", "yale conexis", etc. — homeowner shopping for a
 *  product, not a service. */
const PRODUCT_BRANDS: NegativeKeyword[] = [
  P("yale smart lock"),
  P("yale connect"),
  P("yale conexis"),
  P("yale keyless"),
  P("yale assure"),
  P("yale doorman"),
  P("yale linus"),
  P("yale approach"),
  P("yale matter"),
  P("yale keypad"),
  P("yale app"),
  P("nest yale"),
  P("nest x yale"),
  P("chubb"),
  P("chubb lock"),
  P("chubb mortice"),
  P("mul-t-lock"),
  P("mul t lock"),
  P("multilock"),
  P("assa abloy"),
  P("era"),
  P("era lock"),
  P("avocet"),
  P("avocet abs"),
  P("abs lock"),
  P("kale"),
  P("kale kilit"),
  P("abus"),
  P("brisant"),
  P("ultion"),
  P("ultion lock"),
  P("ultion key"),
  P("banham"),
  P("banham lock"),
  P("squire"),
  P("squire lock"),
  P("ingersoll"),
  P("fab&fix"),
  P("fab and fix"),
  P("mila"),
  P("hoppe"),
  P("yale smart"),
  P("nuki"),
  P("august smart"),
  P("schlage"),
  P("kwikset"),
  P("smart lock review"),
  P("best smart lock"),
  P("amazon ring"),
  P("ring doorbell"),
];

/** Category 7 — Wrong / non-UK geography.
 *  We are UK-only. Phrase-match on US / international city names
 *  catches comparison shoppers from other markets. */
const NON_UK_GEO: NegativeKeyword[] = [
  P("usa"),
  P("us"),
  P("united states"),
  P("america"),
  P("american"),
  P("new york"),
  P("nyc"),
  P("brooklyn"),
  P("manhattan"),
  P("queens"),
  P("bronx"),
  P("los angeles"),
  P("la"),
  P("chicago"),
  P("florida"),
  P("miami"),
  P("orlando"),
  P("texas"),
  P("houston"),
  P("dallas"),
  P("austin"),
  P("boston"),
  P("philadelphia"),
  P("seattle"),
  P("denver"),
  P("atlanta"),
  P("phoenix"),
  P("colorado"),
  P("nevada"),
  P("vegas"),
  P("las vegas"),
  P("san francisco"),
  P("san diego"),
  P("california"),
  P("hawaii"),
  P("canada"),
  P("toronto"),
  P("vancouver"),
  P("montreal"),
  P("calgary"),
  P("ottawa"),
  P("australia"),
  P("sydney"),
  P("melbourne"),
  P("brisbane"),
  P("perth"),
  P("adelaide"),
  P("new zealand"),
  P("auckland"),
  P("ireland"),
  P("dublin"),
  P("cork"),
  P("india"),
  P("delhi"),
  P("mumbai"),
  P("bangalore"),
  P("dubai"),
  P("uae"),
  P("singapore"),
  P("philippines"),
  P("manila"),
  P("south africa"),
  P("johannesburg"),
  P("cape town"),
];

/** Category 8 — Wrong service / out-of-scope.
 *  LockSafe dispatches domestic + commercial door locksmiths. We do NOT
 *  currently service: padlocks, bike/bicycle locks, suitcases, safes,
 *  gun safes, mailboxes, lockers, gates (large industrial), or piano
 *  locks. Block those upfront. */
const OUT_OF_SCOPE: NegativeKeyword[] = [
  P("padlock"),
  P("padlocks"),
  P("bike lock"),
  P("bicycle lock"),
  P("cycle lock"),
  P("kryptonite"),
  P("d lock"),
  P("u lock"),
  P("chain lock"),
  P("suitcase lock"),
  P("luggage lock"),
  P("briefcase lock"),
  P("backpack lock"),
  P("safe"),
  P("safes"),
  P("safe locksmith"),
  P("safe cracker"),
  P("safe cracking"),
  P("safe opening"),
  P("safe combination"),
  P("gun safe"),
  P("vault"),
  P("vaults"),
  P("filing cabinet"),
  P("file cabinet"),
  P("desk drawer"),
  P("drawer lock"),
  P("mailbox lock"),
  P("post box lock"),
  P("postbox lock"),
  P("letterbox lock"),
  P("locker lock"),
  P("locker"),
  P("school locker"),
  P("gym locker"),
  P("piano lock"),
  P("jewelry box"),
  P("jewellery box"),
  P("gate lock"),
  P("electric gate"),
  P("automatic gate"),
  P("garage door"),
  P("garage door repair"),
  P("shed lock"),
  P("shed"),
  P("conservatory"),
  P("window lock"),
  P("window locks"),
  P("upvc window"),
  P("upvc window lock"),
  P("trigger lock"),
  P("ammo lock"),
  P("car key copy"),
  P("car key cutting"),
  P("transponder"),
  P("transponder key"),
  P("rekey at home"),
];

/** Category 9 — Adult / off-topic / pop culture.
 *  Standard universal negatives + locksmith-name-disambiguation
 *  (rapper "Locksmith", Lock band, etc). */
const ADULT_OFF_TOPIC: NegativeKeyword[] = [
  P("porn"),
  P("porno"),
  P("xxx"),
  P("nude"),
  P("naked"),
  P("sex"),
  P("sexy"),
  P("hentai"),
  P("anime"),
  P("manga"),
  P("casino"),
  P("gambling"),
  P("bet"),
  P("betting"),
  P("poker"),
  P("blackjack"),
  P("slot"),
  P("slots"),
  P("meme"),
  P("memes"),
  P("joke"),
  P("jokes"),
  P("prank"),
  P("pranks"),
  P("funny"),
  P("hilarious"),
  P("comedy"),
  P("song"),
  P("songs"),
  P("lyrics"),
  P("rap"),
  P("rapper"),
  P("hip hop"),
  P("hip-hop"),
  P("locksmith rapper"),
  P("locksmith music"),
  P("locksmith song"),
  P("music video"),
  P("spotify"),
  P("apple music"),
  P("mp3"),
  P("mp4"),
  P("download"),
  P("torrent"),
  P("free download"),
  P("recipe"),
  P("recipes"),
  P("cake"),
  P("baking"),
  P("locksmith cake"),
  P("locksmith cocktail"),
  P("locksmith drink"),
  P("locksmith pub"),
  P("locksmith bar"),
  P("locksmith restaurant"),
  P("locksmith hotel"),
  P("the locksmith film"),
  P("the locksmith movie"),
  P("locksmith trailer"),
  P("locksmith netflix"),
  P("locksmith bbc"),
  P("cartoon"),
  P("toy"),
  P("toys"),
  P("story for kids"),
  P("story"),
  P("story book"),
  P("children"),
  P("child"),
  P("kids"),
  P("baby"),
  P("nursery"),
];

/** Category 10 — Free / discount / coupon seekers.
 *  Combined with the playbook §10 content guardrail (no "no call-out
 *  fee" claims), these searchers won't convert with us. */
const FREE_DISCOUNT_SEEKERS: NegativeKeyword[] = [
  P("free"),
  P("for free"),
  P("free locksmith"),
  P("free service"),
  P("free callout"),
  P("free call out"),
  P("freebie"),
  P("free quote"),
  P("free estimate"),
  P("voucher"),
  P("vouchers"),
  P("voucher code"),
  P("coupon"),
  P("coupons"),
  P("coupon code"),
  P("discount code"),
  P("discount codes"),
  P("promo"),
  P("promo code"),
  P("promotion code"),
  P("deal"),
  P("deals"),
  P("offer"),
  P("special offer"),
  P("cashback"),
  P("groupon"),
  P("wowcher"),
  P("livingsocial"),
];

/** Category 11 — Insurance / legal claim adjacency.
 *  "Locksmith claim insurance" — typically tenants chasing landlords
 *  or claim assessors, not buyers. Also lawyer / claim shoppers. */
const INSURANCE_LEGAL: NegativeKeyword[] = [
  P("insurance"),
  P("insurance claim"),
  P("claim"),
  P("claims"),
  P("broker"),
  P("policy"),
  P("excess"),
  P("solicitor"),
  P("lawyer"),
  P("attorney"),
  P("court"),
  P("lawsuit"),
  P("sue"),
  P("compensation"),
  P("ombudsman"),
  P("citizens advice"),
  P("trading standards"),
  P("legal aid"),
];

/** Category 12 — Wikipedia / reference / definition / forum research.
 *  Pure non-buying intent. */
const RESEARCH_REFERENCE: NegativeKeyword[] = [
  P("wikipedia"),
  P("wiki"),
  P("define"),
  P("definition"),
  P("meaning"),
  P("etymology"),
  P("origin"),
  P("origins"),
  P("history of"),
  P("when invented"),
  P("who invented"),
  P("who created"),
  P("reddit"),
  P("quora"),
  P("mumsnet"),
  P("trustpilot"),
  P("forum"),
  P("forums"),
  P("blog"),
  P("blogs"),
  P("article"),
  P("articles"),
  P("podcast"),
  P("podcasts"),
  P("magazine"),
  P("ebook"),
  P("e-book"),
  P("pdf"),
  P("white paper"),
  P("whitepaper"),
  P("infographic"),
  P("statistics"),
  P("stats"),
  P("study"),
  P("research"),
  P("survey"),
  P("benchmark"),
  P("trends"),
  P("forecast"),
];

/** Category 13 — Locksmith content guardrail negatives.
 *  Playbook §10: never claim "no call-out fee" or "free callout".
 *  Block those queries upfront so our ads never appear for them. */
const CONTENT_GUARDRAIL: NegativeKeyword[] = [
  P("no call out fee"),
  P("no call-out fee"),
  P("no callout fee"),
  P("no callout charge"),
  P("no call-out charge"),
  P("no call out charge"),
  P("without call out fee"),
  P("zero callout"),
  P("zero call out"),
  P("nothing to pay"),
];

/** Category 14 — Generic non-commercial.
 *  Universal "every account should block" terms from groas 2026 guide
 *  that are also locksmith-relevant. */
const GENERIC_NON_COMMERCIAL: NegativeKeyword[] = [
  P("scam"),
  P("scammer"),
  P("scams"),
  P("ripoff"),
  P("rip off"),
  P("fake"),
  P("fraud"),
  P("fraudulent"),
  P("complaint"),
  P("complaints"),
  P("complain"),
  P("watchdog"),
  P("bbc watchdog"),
  P("rogue trader"),
  P("rogue traders"),
  P("trader"),
  P("trade body"),
  P("association"),
  P("federation"),
  P("regulator"),
  P("regulation"),
  P("regulations"),
];

/**
 * MASTER LIST — every category concatenated, de-duplicated by text.
 */
export const LOCKSMITH_NEGATIVE_KEYWORDS_MASTER: NegativeKeyword[] = (() => {
  const all = [
    ...PRICE_RESEARCH,
    ...DIY_HOWTO,
    ...PARTS_SPARES_RETAILERS,
    ...LOCKPICKING_HOBBY,
    ...JOBS_TRAINING,
    ...PRODUCT_BRANDS,
    ...NON_UK_GEO,
    ...OUT_OF_SCOPE,
    ...ADULT_OFF_TOPIC,
    ...FREE_DISCOUNT_SEEKERS,
    ...INSURANCE_LEGAL,
    ...RESEARCH_REFERENCE,
    ...CONTENT_GUARDRAIL,
    ...GENERIC_NON_COMMERCIAL,
  ];
  // De-duplicate by (text, matchType). Keep first occurrence (preserves
  // category-order so audits are predictable).
  const seen = new Set<string>();
  const out: NegativeKeyword[] = [];
  for (const kw of all) {
    const key = `${kw.text.toLowerCase()}::${kw.matchType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
})();

/**
 * Categorised export for documentation + maintenance UI.
 */
export const LOCKSMITH_NEGATIVE_KEYWORDS_BY_CATEGORY = {
  price_research: PRICE_RESEARCH,
  diy_howto: DIY_HOWTO,
  parts_spares_retailers: PARTS_SPARES_RETAILERS,
  lockpicking_hobby: LOCKPICKING_HOBBY,
  jobs_training: JOBS_TRAINING,
  product_brands: PRODUCT_BRANDS,
  non_uk_geo: NON_UK_GEO,
  out_of_scope: OUT_OF_SCOPE,
  adult_off_topic: ADULT_OFF_TOPIC,
  free_discount_seekers: FREE_DISCOUNT_SEEKERS,
  insurance_legal: INSURANCE_LEGAL,
  research_reference: RESEARCH_REFERENCE,
  content_guardrail: CONTENT_GUARDRAIL,
  generic_non_commercial: GENERIC_NON_COMMERCIAL,
} as const;

export const LOCKSMITH_NEGATIVE_KEYWORDS_COUNT =
  LOCKSMITH_NEGATIVE_KEYWORDS_MASTER.length;
