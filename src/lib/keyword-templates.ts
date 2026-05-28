/**
 * Keyword-driven SEO templates. Each template represents one high-CPC
 * keyword stem (e.g. `locksmith-near-me`) that is multiplied across every
 * UK city to generate landing pages at `/{slug}-in-{city}`.
 *
 * The records here are the **static seed / fallback**. Runtime source of
 * truth is `keyword-templates-store.ts`, which overlays DB rows from the
 * `KeywordTemplate` Prisma model.
 *
 * Token interpolation: any string field may contain `{city}`, `{region}`,
 * `{county}`, `{areas}`, `{landmarks}`, `{response}`, `{population}`.
 */

export interface KeywordTemplateContent {
  /** SEO <title>. Tokens allowed. */
  metaTitle?: string;
  /** Meta description. Tokens allowed. */
  metaDescription?: string;
  /** H1 (page heading). Tokens allowed. */
  h1?: string;
  /** Short above-the-fold intro. Tokens allowed. */
  intro?: string;
  /** Hero hook for emotional/urgency framing. Tokens allowed. */
  emotionalHook?: string;
  /** Hero subcopy. Tokens allowed. */
  heroSubcopy?: string;
  /** Long-form editorial body (300–700 words). Tokens allowed. */
  seoCopy?: string;
  /**
   * 3–6 bullet points emphasising trust signals — vetted, fast response,
   * insured, etc. Tokens allowed in each entry.
   */
  trustBullets?: string[];
  /**
   * FAQs (FAQPage schema). Tokens allowed in question + answer.
   */
  faqs?: Array<{ question: string; answer: string }>;
  /**
   * Optional CTA label override.
   */
  ctaLabel?: string;
}

export interface KeywordTemplate {
  slug: string;            // "locksmith-near-me"
  label: string;           // "Locksmith Near Me"
  pillarKeyword?: string;  // groups for sitemap priority boost
  intentTags: string[];
  isActive: boolean;
  position: number;
  /** "all" → every city in ukCitiesData; "selected" → only `selectedCities` */
  citiesMode: "all" | "selected";
  selectedCities: string[];
  content: KeywordTemplateContent;
}

// ---------------------------------------------------------------------------
// High-CPC keyword presets — the most expensive and highest-volume keywords
// in the UK locksmith vertical. CPC research (Ahrefs/SEMrush) places these
// in the £8-£25/click bracket. Each generates {city-count} landing pages.
// ---------------------------------------------------------------------------

export const KEYWORD_TEMPLATES: KeywordTemplate[] = [
  {
    slug: "locksmith-near-me",
    label: "Locksmith Near Me",
    pillarKeyword: "locksmith",
    intentTags: ["near-me", "local", "general"],
    isActive: true,
    position: 1,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Locksmith Near Me in {city} | 24/7 Local Locksmiths | LockSafe UK",
      metaDescription:
        "Looking for a locksmith near you in {city}? LockSafe UK connects you with vetted, insured local locksmiths across {region}. {response} response. Get a free quote now.",
      h1: "Locksmith Near Me in {city}",
      intro:
        "Need a locksmith near you in {city}? LockSafe UK matches you with vetted, fully-insured local locksmiths covering {areas} and surrounding areas. Transparent upfront pricing with an assessment fee shown before you commit, and a {response} response on emergency jobs.",
      emotionalHook:
        "Locked out in {city}? Help is closer than you think — vetted locksmiths near you, on-site fast.",
      heroSubcopy:
        "Real locksmiths from {city}. No middlemen, no inflated quotes. Just a fast, fair fix.",
      seoCopy:
        "When you search for a locksmith near me in {city}, you need someone who can actually get to you fast — not a national call-centre that subcontracts to whoever is cheapest. LockSafe UK takes a different approach. Every locksmith on our network covers a specific patch of {region} ({areas} and beyond), so the technician you book is genuinely local. They know the streets, the landmarks ({landmarks}), and the typical lock setups in {city} properties. Whether you're locked out of your home or car, need a lock changed after a break-in, or want fresh keys cut on the spot, our {city} locksmiths can usually be on-site within {response}. Pricing is transparent — you'll see a fair fixed quote before any work begins, with no hidden extras.",
      trustBullets: [
        "Vetted & DBS-checked locksmiths covering {city}",
        "{response} average response across {region}",
        "Fixed upfront pricing — assessment fee shown before you commit",
        "Fully insured, 12-month workmanship guarantee",
        "Serving {areas} and surrounding postcodes",
      ],
      faqs: [
        {
          question: "How quickly can a locksmith reach me in {city}?",
          answer:
            "Most LockSafe UK locksmiths in {city} are on-site within {response}. We'll show you the locksmith's exact distance and ETA before you confirm.",
        },
        {
          question: "How much does a locksmith cost in {city}?",
          answer:
            "Typical lockouts in {city} cost £65–£120 depending on the lock type and time of day. An upfront assessment fee applies (typically £25–£49), then a fixed quote before any work begins — no hidden extras.",
        },
        {
          question: "Are your {city} locksmiths insured and vetted?",
          answer:
            "Yes — every locksmith on the LockSafe UK network covering {city} is DBS-checked, fully insured, and reviewed continuously.",
        },
      ],
      ctaLabel: "Find a locksmith in {city}",
    },
  },
  {
    slug: "emergency-locksmith-near-me",
    label: "Emergency Locksmith Near Me",
    pillarKeyword: "emergency-locksmith",
    intentTags: ["emergency", "urgent", "near-me"],
    isActive: true,
    position: 2,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Emergency Locksmith Near Me in {city} | 24/7 Callout | LockSafe UK",
      metaDescription:
        "24/7 emergency locksmith near you in {city}. Locked out, broken key, or break-in? Vetted local locksmiths, {response} response, upfront pricing. Call now.",
      h1: "Emergency Locksmith Near Me in {city}",
      intro:
        "Locked out, broken key, or post-burglary lock-change in {city}? An emergency locksmith near you is one tap away. LockSafe UK dispatches the closest vetted locksmith — {response} response, 24/7, across {areas}.",
      emotionalHook:
        "Stranded at your own front door in {city}? Don't panic — an emergency locksmith is minutes away.",
      heroSubcopy:
        "24/7 emergency locksmith cover across {region}. Fast, calm, no judgement.",
      seoCopy:
        "An emergency locksmith near me in {city} needs to be three things: close, qualified, and contactable right now. LockSafe UK guarantees all three. Our 24/7 dispatch instantly routes your call to the nearest available locksmith covering {city} — typically a {response} ETA — so you're not left on the doorstep at 2 a.m. waiting for someone to drive in from out of town. Common emergencies our {city} network handles every day: lockouts (no damage, non-destructive entry where possible), snapped keys in the cylinder, broken UPVC mechanisms, lost keys, and post-burglary lock changes including same-night insurance-approved upgrades to British Standard BS3621. Whatever the situation across {areas}, we'll have a vetted, insured technician with you fast.",
      trustBullets: [
        "24/7 emergency dispatch — including nights, weekends, bank holidays",
        "{response} average response in {city}",
        "Non-destructive entry first — your door stays intact when possible",
        "Insurance-approved BS3621 upgrades after a break-in",
        "Vetted, DBS-checked locksmiths covering all of {region}",
      ],
      faqs: [
        {
          question: "How fast can an emergency locksmith reach me in {city}?",
          answer:
            "Our {city} emergency network averages {response}. Late-night response is the same — we run a full overnight rota.",
        },
        {
          question: "Will an emergency locksmith damage my door in {city}?",
          answer:
            "No — our {city} locksmiths use non-destructive entry techniques wherever possible. Drilling is a last resort and you'll be told before any work begins.",
        },
        {
          question: "What does an emergency locksmith cost in {city}?",
          answer:
            "An assessment fee applies (set by each locksmith, typically £25–£49) and is shown upfront before you commit. You'll see the full all-in quote before any work begins, including any out-of-hours surcharge.",
        },
      ],
      ctaLabel: "Get an emergency locksmith in {city}",
    },
  },
  {
    slug: "24-hour-locksmith-near-me",
    label: "24 Hour Locksmith Near Me",
    pillarKeyword: "emergency-locksmith",
    intentTags: ["24-hour", "emergency", "night"],
    isActive: true,
    position: 3,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "24 Hour Locksmith Near Me in {city} | Round-the-Clock Cover | LockSafe UK",
      metaDescription:
        "24 hour locksmith service in {city}. Day, night, weekend, bank holiday. {response} response. Vetted local locksmiths across {region}. Upfront assessment fee.",
      h1: "24 Hour Locksmith Near Me in {city}",
      intro:
        "Lock problems don't keep office hours — and neither do we. A 24 hour locksmith near you in {city} is on duty right now, with a {response} average response across {areas}.",
      emotionalHook:
        "It's 3 a.m. in {city} and you're locked out — we're already on the way.",
      heroSubcopy: "True 24/7 cover in {city}. Real locksmiths, awake and ready.",
      seoCopy:
        "Searching for a 24 hour locksmith near me in {city} usually means something has gone wrong at the worst possible time. LockSafe UK runs a genuine round-the-clock rota across {region}, so when you tap call at 3 a.m. you get a real locksmith — not a voicemail and a callback in the morning. Our {city} network covers lockouts, snapped keys, broken locks, and post-burglary lock changes through the night, on weekends, and on every bank holiday of the year. {response} response is the same at midnight as it is at midday.",
      trustBullets: [
        "True 24/7 cover in {city} — no answering service, no callbacks",
        "{response} response, day or night",
        "Same fixed pricing rules at any hour",
        "Vetted, insured, DBS-checked locksmiths",
        "Covering {areas} and all of {region}",
      ],
      faqs: [
        {
          question: "Do you really operate 24 hours in {city}?",
          answer:
            "Yes — LockSafe UK runs a genuine overnight rota covering {city}. Every hour of every day, year-round.",
        },
        {
          question: "Is a 24 hour locksmith more expensive in {city}?",
          answer:
            "Out-of-hours work carries a small surcharge in {city} (typically £20–£40 on top of the base price). You'll see the full quote before any work begins.",
        },
      ],
      ctaLabel: "Call a 24/7 locksmith in {city}",
    },
  },
  {
    slug: "auto-locksmith-near-me",
    label: "Auto Locksmith Near Me",
    pillarKeyword: "auto-locksmith",
    intentTags: ["auto", "car", "vehicle"],
    isActive: true,
    position: 4,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Auto Locksmith Near Me in {city} | Car Key Replacement | LockSafe UK",
      metaDescription:
        "Auto locksmith near you in {city}. Car lockouts, key replacement, transponder programming, key cutting. {response} response. Mobile service across {region}.",
      h1: "Auto Locksmith Near Me in {city}",
      intro:
        "Locked out of your car in {city}? Need a transponder key cut, programmed, or replaced? An auto locksmith near you is dispatchable now — fully mobile across {areas}.",
      emotionalHook:
        "Stranded next to your own car in {city}? A specialist auto locksmith is closer than the dealership.",
      heroSubcopy:
        "Cheaper than the dealer. Faster than the AA. Same-day key replacement in {city}.",
      seoCopy:
        "When you search auto locksmith near me in {city}, the alternative is usually a £400+ trip to the main dealer or a long wait for breakdown cover. LockSafe UK's {city} auto locksmiths come to you, anywhere across {region}, with a fully equipped mobile workshop. We cover car lockouts (non-destructive entry on most makes), spare key cutting, transponder and remote key programming, ignition repair, and full key-replacement when the originals are lost. Most jobs are completed roadside in under an hour — and we typically save you 40–60% versus dealer prices.",
      trustBullets: [
        "All makes covered — Ford, VW, BMW, Mercedes, Toyota, Audi, Vauxhall and more",
        "Roadside service across {city} and {areas}",
        "Transponder & remote key programming on-site",
        "40–60% cheaper than main-dealer key replacement",
        "{response} mobile response in {region}",
      ],
      faqs: [
        {
          question: "How much does car key replacement cost in {city}?",
          answer:
            "Basic transponder keys for older cars in {city} start around £120 all-in. Modern proximity / smart keys are £180–£350 depending on make. Always 40–60% under main-dealer pricing.",
        },
        {
          question: "Can you reach my car anywhere in {city}?",
          answer:
            "Yes — our {city} auto locksmiths are fully mobile and cover {areas} plus the surrounding {region} road network.",
        },
      ],
      ctaLabel: "Get an auto locksmith in {city}",
    },
  },
  {
    slug: "car-locksmith-near-me",
    label: "Car Locksmith Near Me",
    pillarKeyword: "auto-locksmith",
    intentTags: ["car", "auto"],
    isActive: true,
    position: 5,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Car Locksmith Near Me in {city} | Lockout & Key Cutting | LockSafe UK",
      metaDescription:
        "Car locksmith in {city} — lockouts, lost keys, transponder programming. Mobile service, {response} response across {region}. No tow needed.",
      h1: "Car Locksmith Near Me in {city}",
      intro:
        "A car locksmith near you in {city} can unlock, re-key, or replace lost car keys roadside — no tow truck required. Mobile cover across {areas}.",
      emotionalHook:
        "Don't tow your car in {city} — a mobile car locksmith comes to you.",
      heroSubcopy:
        "Lost keys, lockouts, broken fobs — fixed where your car is parked.",
      seoCopy:
        "If you've searched car locksmith near me in {city}, you almost certainly don't need a tow. LockSafe UK's {city} car locksmiths come to wherever your car is parked — driveway, supermarket car park, motorway services — with mobile programming equipment for nearly every make sold in the UK. Common jobs across {region}: lockouts (typically 10–20 minute on-site fix), lost-key replacement (transponder cutting + ECU programming), broken / damaged keys, ignition lock repair, and central-locking faults.",
      trustBullets: [
        "Roadside-only — no need to tow your car",
        "Covers {areas} and all of {region}",
        "{response} mobile response",
        "All major makes & models",
        "Saves £200–£400 vs main-dealer",
      ],
      faqs: [
        {
          question: "Will I need to tow my car to a locksmith in {city}?",
          answer:
            "No — our {city} car locksmiths are fully mobile. They come to your car with all programming gear on-board.",
        },
      ],
      ctaLabel: "Find a car locksmith in {city}",
    },
  },
  {
    slug: "lock-change-near-me",
    label: "Lock Change Near Me",
    pillarKeyword: "lock-change",
    intentTags: ["lock-change", "replacement"],
    isActive: true,
    position: 6,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Lock Change Near Me in {city} | British Standard Locks Fitted | LockSafe UK",
      metaDescription:
        "Need a lock change in {city}? Vetted locksmiths fit insurance-approved BS3621 locks across {region}. Same-day service, fixed pricing, fully insured.",
      h1: "Lock Change Near Me in {city}",
      intro:
        "A lock change near you in {city} — same-day, insurance-approved, fully fitted. LockSafe UK covers {areas} with vetted locksmiths and British Standard BS3621 locks as standard.",
      emotionalHook:
        "Just moved into a new place in {city}? Change the locks today — peace of mind tonight.",
      heroSubcopy:
        "Same-day lock changes across {city}. BS3621 insurance-grade locks.",
      seoCopy:
        "Searching lock change near me in {city} usually means one of three things: you've just moved in, you've lost a set of keys, or there's been a burglary or split with a partner who still has access. Whatever the reason, LockSafe UK's {city} locksmiths fit insurance-approved BS3621 mortice locks and TS007 3-star euro cylinders the same day, anywhere across {region}. We carry stock for the most common UK door types so {city} residents don't have to wait for parts.",
      trustBullets: [
        "Same-day lock changes in {city}",
        "BS3621 & TS007 3-star — insurance-approved",
        "Covers {areas} and surrounding postcodes",
        "Fixed upfront pricing — assessment fee shown before you commit",
        "12-month workmanship guarantee",
      ],
      faqs: [
        {
          question: "How much does a lock change cost in {city}?",
          answer:
            "A standard front-door lock change in {city} is £95–£180 including the British Standard lock cylinder. UPVC / multipoint locks may be slightly higher.",
        },
        {
          question: "Are the locks insurance-approved in {city}?",
          answer:
            "Yes — every lock we fit in {city} meets BS3621 or TS007 3-star, the two standards required by every major UK home insurer.",
        },
      ],
      ctaLabel: "Book a lock change in {city}",
    },
  },
  {
    slug: "mobile-locksmith-near-me",
    label: "Mobile Locksmith Near Me",
    pillarKeyword: "locksmith",
    intentTags: ["mobile", "near-me"],
    isActive: true,
    position: 7,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Mobile Locksmith Near Me in {city} | We Come to You | LockSafe UK",
      metaDescription:
        "Mobile locksmith in {city} — vans equipped for lockouts, lock changes, auto keys. {response} response across {region}. Pay only when the job is done.",
      h1: "Mobile Locksmith Near Me in {city}",
      intro:
        "A mobile locksmith near you in {city} arrives van-equipped for any lock or key job — lockouts, lock changes, car keys, key cutting. Mobile cover across {areas}.",
      heroSubcopy: "Van comes to you. No appointment needed.",
      seoCopy:
        "LockSafe UK's mobile locksmiths in {city} carry everything needed on-board: BS3621 mortice locks, TS007 cylinders, common UPVC mechanisms, key-cutting machines, transponder programmers, and non-destructive entry tools. You don't need to bring anything to us — we come to your door, anywhere across {region}, and complete most jobs in a single visit.",
      trustBullets: [
        "Van-equipped — no second visits",
        "Covers {areas} and all of {region}",
        "{response} mobile response",
        "Pay only when work is complete",
      ],
      ctaLabel: "Get a mobile locksmith in {city}",
    },
  },
  {
    slug: "commercial-locksmith-near-me",
    label: "Commercial Locksmith Near Me",
    pillarKeyword: "commercial-locksmith",
    intentTags: ["commercial", "business"],
    isActive: true,
    position: 8,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Commercial Locksmith Near Me in {city} | Office & Retail | LockSafe UK",
      metaDescription:
        "Commercial locksmith in {city}. Master key systems, access control, panic bars, safes. Out-of-hours cover across {region}. {response} response.",
      h1: "Commercial Locksmith Near Me in {city}",
      intro:
        "Commercial locksmith services in {city} — master-key systems, access control, panic bars, safes, and after-hours emergency cover for offices, retail, and industrial sites across {areas}.",
      heroSubcopy: "Office, retail, warehouse — secured to commercial spec.",
      seoCopy:
        "Commercial premises in {city} need more than a domestic locksmith. LockSafe UK's commercial network across {region} fits restricted-keyway master systems (so you can give cleaners access without giving them the keys to the safe), DDA-compliant panic bars, electronic access control, and safe installation / opening. Maintenance contracts available for multi-site operations across {areas}.",
      trustBullets: [
        "Master-key & restricted keyway systems",
        "Access control & panic bars",
        "Safe installation, opening, and combination resets",
        "Out-of-hours emergency cover for {city} businesses",
        "Maintenance contracts available across {region}",
      ],
      ctaLabel: "Book a commercial locksmith in {city}",
    },
  },
  {
    slug: "locked-out-locksmith-near-me",
    label: "Locked Out Locksmith Near Me",
    pillarKeyword: "emergency-locksmith",
    intentTags: ["locked-out", "lockout", "urgent"],
    isActive: true,
    position: 9,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "Locked Out Locksmith Near Me in {city} | Fast Entry | LockSafe UK",
      metaDescription:
        "Locked out in {city}? A locksmith near you is {response} away. Non-destructive entry, upfront assessment fee. Covers {region}.",
      h1: "Locked Out in {city}? Locksmith Near Me",
      intro:
        "Locked out of your home in {city}? Don't panic and don't kick the door — a locksmith near you can be on-site in {response} with non-destructive entry tools.",
      emotionalHook:
        "Don't kick the door in {city} — a locksmith is minutes away.",
      heroSubcopy: "Non-destructive entry first. Your door stays intact.",
      seoCopy:
        "Being locked out in {city} feels like the worst-case scenario, but it's one of the easiest things our locksmiths do. The vast majority of front-door lockouts across {areas} are resolved with non-destructive entry techniques — letterbox tools, picking, or bypass — which means no drilling and no damage. {response} on-site, fixed price, on your way in under 20 minutes.",
      trustBullets: [
        "Non-destructive entry first — door stays intact",
        "{response} response in {city}",
        "Fixed upfront price — assessment fee shown before you commit",
        "DBS-checked, fully insured locksmiths",
      ],
      faqs: [
        {
          question: "Will the locksmith have to drill my lock in {city}?",
          answer:
            "Almost never. Our {city} locksmiths use picking, bypass, and letterbox tools first — drilling is a last resort and you'll be told before it happens.",
        },
      ],
      ctaLabel: "Get help — I'm locked out in {city}",
    },
  },
  {
    slug: "upvc-door-locksmith-near-me",
    label: "UPVC Door Locksmith Near Me",
    pillarKeyword: "lock-change",
    intentTags: ["upvc", "door", "multipoint"],
    isActive: true,
    position: 10,
    citiesMode: "all",
    selectedCities: [],
    content: {
      metaTitle: "UPVC Door Locksmith Near Me in {city} | Multipoint Lock Repair | LockSafe UK",
      metaDescription:
        "UPVC door locksmith in {city}. Multipoint locks, gearbox replacement, euro cylinder upgrades to TS007 3-star. {response} response across {region}.",
      h1: "UPVC Door Locksmith Near Me in {city}",
      intro:
        "UPVC door problems in {city} — stuck multipoint, snapped key, broken gearbox, draughty seal? A specialist UPVC locksmith near you covers {areas} with parts on-board.",
      heroSubcopy: "Stuck UPVC? Don't force it — call a specialist.",
      seoCopy:
        "UPVC doors are everywhere in {city}, and when they fail they tend to fail catastrophically — gearbox snaps mid-turn, multipoint won't engage, key snaps in the cylinder. LockSafe UK's UPVC specialists across {region} carry the most common multipoint gearboxes (Fuhr, Maco, Yale, ERA, GU) on-board, plus TS007 3-star anti-snap cylinders for insurance-grade upgrades. Most jobs in {city} are fixed in a single same-day visit.",
      trustBullets: [
        "Common gearboxes carried on-van",
        "TS007 3-star anti-snap cylinders fitted",
        "Same-day fix in {city}",
        "Covers {areas} and {region}",
      ],
      ctaLabel: "Book a UPVC specialist in {city}",
    },
  },
];

// ---------------------------------------------------------------------------
// Sync helpers (used at build time before DB store is available, e.g. when
// generating type-level constants for tests). Runtime callers should prefer
// the async helpers in `keyword-templates-store.ts`.
// ---------------------------------------------------------------------------

export function getKeywordTemplateBySlug(
  slug: string,
): KeywordTemplate | undefined {
  return KEYWORD_TEMPLATES.find((t) => t.slug === slug);
}

export function getActiveKeywordTemplates(): KeywordTemplate[] {
  return KEYWORD_TEMPLATES.filter((t) => t.isActive !== false).sort(
    (a, b) => a.position - b.position,
  );
}
