/**
 * Competitor "alternative" landing pages.
 *
 * URL surface: /alternatives  (hub)  and  /alternatives/{slug}.
 *
 * EDITORIAL / LEGAL NOTE:
 * These pages name real companies. Copy is deliberately FACTUAL and NEUTRAL
 * about each competitor (category description only) and leads with LockSafe's
 * own verifiable differentiators. Do NOT add unverified or disparaging claims
 * about a named business (pricing, conduct, etc.). Frame everything as
 * "how LockSafe compares" / "what to look for in an alternative".
 *
 * Single source of truth — the route templates and the sitemap both read from
 * getAllCompetitorSlugs() / getCompetitorBySlug() so new entries appear
 * everywhere automatically.
 */

export type CompetitorCategory = "chain" | "directory" | "generic";

export interface ComparisonRow {
  /** What is being compared, e.g. "Price before work starts". */
  dimension: string;
  /** Neutral, defensible statement about the alternative / category. */
  them: string;
  /** LockSafe's verifiable position. */
  lockSafe: string;
}

export interface CompetitorFaq {
  q: string;
  a: string;
}

export interface CompetitorAlternative {
  /** URL slug under /alternatives/. */
  slug: string;
  /** Display name used in copy and headings. */
  name: string;
  category: CompetitorCategory;

  // ── SEO metadata ──────────────────────────────────────────────
  metaTitle: string;
  metaDescription: string;
  keywords: string[];

  // ── Page content ──────────────────────────────────────────────
  /** One-line hero subheading. */
  heroIntro: string;
  /** Neutral factual description of what the competitor/category is. */
  whatTheyAre: string;
  /** 2–4 short paragraphs of body copy (LockSafe-positive, neutral on them). */
  body: string[];
  /** Side-by-side comparison rows. */
  comparison: ComparisonRow[];
  /** LockSafe differentiator bullets. */
  whyLockSafe: string[];
  faqs: CompetitorFaq[];
}

/**
 * Shared LockSafe differentiators — every page reuses these so the brand
 * promise stays consistent. Each one is verifiable from the product itself.
 */
const LOCKSAFE_DIFFERENTIATORS: string[] = [
  "You see the full quote BEFORE any work starts — accept or decline, no pressure.",
  "Every job creates a legally-binding digital paper trail: GPS, timestamped photos, digital signature and an instant PDF report.",
  "Automatic refund if your locksmith doesn't arrive within the agreed ETA.",
  "Every locksmith is DBS-checked, insured and ID-verified before they can take a job.",
  "100% free for customers — no platform fee, no markup, no hidden charges.",
];

const COMPETITORS: readonly CompetitorAlternative[] = Object.freeze([
  // ── National locksmith chains ───────────────────────────────────────────
  {
    slug: "keytek",
    name: "Keytek",
    category: "chain",
    metaTitle:
      "Keytek Alternative — Verified Locksmiths, Upfront Quotes | LockSafe UK",
    metaDescription:
      "Looking for a Keytek alternative? LockSafe gives you the full price before any work starts, DBS-checked locksmiths, and a legally-binding PDF report on every job. Free for customers.",
    keywords: [
      "Keytek alternative",
      "alternative to Keytek",
      "Keytek locksmith alternative",
      "locksmith like Keytek",
      "Keytek competitor",
    ],
    heroIntro:
      "A transparent, fully-documented way to book a verified locksmith — with the price agreed before any work begins.",
    whatTheyAre:
      "Keytek is a national UK locksmith brand that dispatches locksmiths for emergency and scheduled lock work. If you're comparing options, here's how LockSafe's model works and where it differs.",
    body: [
      "LockSafe is a platform, not a single dispatcher. You post your job, verified locksmiths near you respond, and you choose who attends based on their fee, ETA, rating and reviews — so you stay in control of who turns up and what you pay.",
      "The core difference is documentation. Every LockSafe job is recorded end-to-end: GPS-verified arrival, before/after photos, a digital signature and an instant PDF report. If anything is ever disputed, you have proof rather than your word against theirs.",
      "And you only ever commit after seeing a full, itemised quote. Decline it and you pay nothing but the assessment fee you agreed upfront.",
    ],
    comparison: [
      {
        dimension: "Price before work starts",
        them: "Varies by job and locksmith",
        lockSafe: "Full itemised quote shown upfront — accept or decline",
      },
      {
        dimension: "Choose your locksmith",
        them: "Locksmith is dispatched to you",
        lockSafe: "Compare fees, ETAs, ratings and pick who attends",
      },
      {
        dimension: "Documentation",
        them: "Depends on the individual job",
        lockSafe: "GPS, photos, signature and PDF report on every job",
      },
      {
        dimension: "No-show protection",
        them: "Varies",
        lockSafe: "Automatic refund if the locksmith misses the agreed ETA",
      },
      {
        dimension: "Cost to customer",
        them: "Standard locksmith pricing",
        lockSafe: "Platform is free for customers",
      },
    ],
    whyLockSafe: LOCKSAFE_DIFFERENTIATORS,
    faqs: [
      {
        q: "Is LockSafe a direct alternative to Keytek?",
        a: "LockSafe covers the same emergency and scheduled locksmith jobs — lockouts, lock changes, broken keys, uPVC repairs and more — but as a platform where you compare verified locksmiths and approve a fixed quote before work begins.",
      },
      {
        q: "How fast can a locksmith arrive?",
        a: "Average response across the LockSafe network is 15–30 minutes, 24/7, depending on your location and locksmith availability.",
      },
      {
        q: "What does it cost?",
        a: "LockSafe is free for customers. You pay only the locksmith's assessment fee (shown upfront) and the work quote you choose to accept.",
      },
    ],
  },
  {
    slug: "timpson",
    name: "Timpson",
    category: "chain",
    metaTitle:
      "Timpson Locksmith Alternative — 24/7 Emergency Cover | LockSafe UK",
    metaDescription:
      "Need a Timpson locksmith alternative for emergencies or out-of-hours work? LockSafe connects you with verified, DBS-checked locksmiths, upfront quotes and full documentation. Free for customers.",
    keywords: [
      "Timpson locksmith alternative",
      "alternative to Timpson",
      "Timpson key cutting alternative",
      "Timpson locksmith",
      "emergency locksmith instead of Timpson",
    ],
    heroIntro:
      "24/7 verified locksmiths for the jobs a high-street shop can't cover — at your door, with the price agreed first.",
    whatTheyAre:
      "Timpson is a well-known high-street service brand offering key cutting and some locksmith services. For emergency call-outs, lockouts and on-site lock work, here's how LockSafe compares.",
    body: [
      "LockSafe is built around mobile, on-demand locksmith call-outs — including nights, weekends and bank holidays — rather than a shop counter. Post your job and verified locksmiths come to you.",
      "You see a full quote before any work starts, choose your locksmith from those who respond, and every job is documented with GPS, photos, a signature and a PDF report.",
      "If your need is simply cutting a spare key, a high-street counter may be perfect. For lockouts, lock changes, break-in repairs and out-of-hours emergencies at your property, LockSafe is designed for exactly that.",
    ],
    comparison: [
      {
        dimension: "Comes to you",
        them: "Primarily counter / in-store",
        lockSafe: "Mobile locksmiths attend your property",
      },
      {
        dimension: "Out-of-hours emergencies",
        them: "Limited by opening hours",
        lockSafe: "24/7, 365 days a year",
      },
      {
        dimension: "Price before work starts",
        them: "Varies",
        lockSafe: "Full itemised quote upfront — accept or decline",
      },
      {
        dimension: "Documentation",
        them: "Varies",
        lockSafe: "GPS, photos, signature and PDF report on every job",
      },
      {
        dimension: "Cost to customer",
        them: "Standard pricing",
        lockSafe: "Platform is free for customers",
      },
    ],
    whyLockSafe: LOCKSAFE_DIFFERENTIATORS,
    faqs: [
      {
        q: "Can LockSafe help when shops are closed?",
        a: "Yes — LockSafe operates 24/7. Posting a job at 3am works the same as 3pm, with verified locksmiths covering nights and weekends.",
      },
      {
        q: "Does LockSafe cut keys?",
        a: "LockSafe locksmiths handle key-related jobs such as broken-key extraction and car key replacement on-site. For a simple spare key, a high-street counter may be quicker — LockSafe is built for call-outs and emergencies.",
      },
      {
        q: "How do I know the locksmith is trustworthy?",
        a: "Every LockSafe locksmith is DBS-checked, insured and ID-verified, and you can see their rating and reviews before accepting a bid.",
      },
    ],
  },

  // ── Directories / lead-generation sites ─────────────────────────────────
  {
    slug: "checkatrade",
    name: "Checkatrade",
    category: "directory",
    metaTitle:
      "Checkatrade Alternative for Locksmiths — Fixed Quotes First | LockSafe UK",
    metaDescription:
      "A Checkatrade alternative for finding a locksmith: with LockSafe you get a fixed quote before work, a refund guarantee if they don't show, and a full PDF record of the job. Free for customers.",
    keywords: [
      "Checkatrade alternative",
      "alternative to Checkatrade locksmith",
      "Checkatrade locksmith",
      "find a locksmith without Checkatrade",
      "Checkatrade competitor",
    ],
    heroIntro:
      "Find a verified locksmith and lock in the price first — with refund protection and a documented job, not just a listing.",
    whatTheyAre:
      "Checkatrade is a directory that helps you find tradespeople, including locksmiths, and read reviews. LockSafe goes a step further: it manages the whole job, the quote and the documentation, not just the introduction.",
    body: [
      "On a directory, you find a name and then arrange everything — price, timing and terms — directly with that individual trader. LockSafe handles the booking end-to-end: verified locksmiths respond to your job, you compare them, and you approve a fixed quote inside the platform before work starts.",
      "Because the job runs through LockSafe, you also get protections a listing can't give you: an automatic refund if the locksmith misses the agreed ETA, and a complete PDF record of the work — GPS, photos and a digital signature.",
      "If you simply want to browse reviews, a directory is useful. If you want the price agreed, the locksmith verified, and the whole job documented and protected, that's what LockSafe is for.",
    ],
    comparison: [
      {
        dimension: "What you get",
        them: "A directory of traders to contact",
        lockSafe: "A managed booking with a fixed, pre-agreed quote",
      },
      {
        dimension: "Price certainty",
        them: "Arranged directly with each trader",
        lockSafe: "Itemised quote approved before work begins",
      },
      {
        dimension: "No-show protection",
        them: "Not provided by the directory",
        lockSafe: "Automatic refund if the agreed ETA is missed",
      },
      {
        dimension: "Job documentation",
        them: "Down to the individual trader",
        lockSafe: "GPS, photos, signature and PDF report every time",
      },
      {
        dimension: "Cost to customer",
        them: "Free to search",
        lockSafe: "Free to customers",
      },
    ],
    whyLockSafe: LOCKSAFE_DIFFERENTIATORS,
    faqs: [
      {
        q: "How is LockSafe different from a directory?",
        a: "A directory introduces you to a trader; LockSafe manages the whole job — verification, a fixed upfront quote, no-show refund protection and full documentation — inside one platform.",
      },
      {
        q: "Are the locksmiths vetted?",
        a: "Yes. Every locksmith is DBS-checked, insured and ID-verified before they can take a job, and you see ratings and reviews before you choose.",
      },
      {
        q: "Is there a fee to use LockSafe?",
        a: "No — it's free for customers. You pay only the assessment fee and the work quote you accept.",
      },
    ],
  },
  {
    slug: "rated-people",
    name: "Rated People",
    category: "directory",
    metaTitle:
      "Rated People Alternative for Locksmiths — Verified & Documented | LockSafe UK",
    metaDescription:
      "A Rated People alternative for locksmith jobs: post once, compare verified DBS-checked locksmiths, approve a fixed quote, and get a refund if they don't show. Free for customers.",
    keywords: [
      "Rated People alternative",
      "alternative to Rated People locksmith",
      "Rated People locksmith",
      "find a locksmith Rated People",
      "Rated People competitor",
    ],
    heroIntro:
      "Post your job once, compare verified locksmiths, and approve a fixed quote — with the job fully documented.",
    whatTheyAre:
      "Rated People is a marketplace that matches homeowners with tradespeople who then quote for the work. LockSafe uses a similar post-and-compare flow but adds verification, fixed upfront quotes and full job documentation.",
    body: [
      "With LockSafe you describe your problem once and verified locksmiths near you respond. You compare them on fee, ETA, rating and reviews, then approve a single itemised quote before anyone starts work.",
      "Every job is then recorded with GPS, timestamped photos, a digital signature and an instant PDF report — and if your locksmith doesn't arrive within the agreed ETA, you're refunded automatically.",
      "It's the convenience of a marketplace with the certainty and protection of a managed booking.",
    ],
    comparison: [
      {
        dimension: "Booking model",
        them: "Post a job, traders quote",
        lockSafe:
          "Post a job, verified locksmiths quote — fixed price approved upfront",
      },
      {
        dimension: "Locksmith verification",
        them: "Varies by member",
        lockSafe: "DBS-checked, insured and ID-verified",
      },
      {
        dimension: "No-show protection",
        them: "Not provided",
        lockSafe: "Automatic refund if the agreed ETA is missed",
      },
      {
        dimension: "Documentation",
        them: "Down to the individual trader",
        lockSafe: "GPS, photos, signature and PDF report every time",
      },
      {
        dimension: "Cost to customer",
        them: "Free to post",
        lockSafe: "Free to customers",
      },
    ],
    whyLockSafe: LOCKSAFE_DIFFERENTIATORS,
    faqs: [
      {
        q: "Does LockSafe work like a marketplace?",
        a: "Yes — you post your job and verified locksmiths respond. The difference is that quotes are fixed and approved upfront, the locksmiths are vetted, and every job is documented and protected.",
      },
      {
        q: "What if the locksmith doesn't turn up?",
        a: "If they miss the agreed ETA plus a grace period, you receive an automatic refund — no need to chase it.",
      },
      {
        q: "Is it free?",
        a: "Yes, LockSafe is free for customers. You pay only the assessment fee and any work quote you choose to accept.",
      },
    ],
  },
  {
    slug: "bark",
    name: "Bark",
    category: "directory",
    metaTitle:
      "Bark Alternative for Locksmiths — No Cold Calls, Fixed Quotes | LockSafe UK",
    metaDescription:
      "A Bark alternative for finding a locksmith: with LockSafe you compare verified locksmiths, approve a fixed quote before work, and get a documented, refund-protected job. Free for customers.",
    keywords: [
      "Bark alternative",
      "alternative to Bark locksmith",
      "Bark locksmith",
      "find a locksmith without Bark",
      "Bark competitor locksmith",
    ],
    heroIntro:
      "Get matched with verified locksmiths and a fixed quote — without handing your details to a queue of cold callers.",
    whatTheyAre:
      "Bark is a lead-generation marketplace that connects customers with service professionals across many categories. For locksmith jobs specifically, LockSafe offers a focused, verified flow with fixed upfront pricing.",
    body: [
      "LockSafe is built only for locksmith work, so the people who respond are verified locksmiths — DBS-checked, insured and rated — not a broad pool of professionals across unrelated trades.",
      "You approve a single fixed quote before any work starts, choose your locksmith from those who respond, and every job is documented with GPS, photos, a signature and a PDF report.",
      "And because the job is managed inside LockSafe, you get an automatic refund if your locksmith doesn't arrive within the agreed time.",
    ],
    comparison: [
      {
        dimension: "Focus",
        them: "Many service categories",
        lockSafe: "Locksmith work only — specialist network",
      },
      {
        dimension: "Who responds",
        them: "Professionals who buy the lead",
        lockSafe: "Verified, DBS-checked locksmiths",
      },
      {
        dimension: "Price certainty",
        them: "Negotiated directly",
        lockSafe: "Fixed itemised quote approved upfront",
      },
      {
        dimension: "No-show protection",
        them: "Not provided",
        lockSafe: "Automatic refund if the agreed ETA is missed",
      },
      {
        dimension: "Cost to customer",
        them: "Free to request",
        lockSafe: "Free to customers",
      },
    ],
    whyLockSafe: LOCKSAFE_DIFFERENTIATORS,
    faqs: [
      {
        q: "Will I get lots of calls if I use LockSafe?",
        a: "No. You post your job and verified locksmiths submit bids inside the platform — you choose who to engage, on your terms.",
      },
      {
        q: "Are the locksmiths vetted?",
        a: "Yes — DBS-checked, insured and ID-verified, with ratings and reviews visible before you accept a bid.",
      },
      {
        q: "Is there any cost to me?",
        a: "LockSafe is free for customers. You pay only the assessment fee and the work quote you accept.",
      },
    ],
  },

  // ── Generic / non-branded angle ─────────────────────────────────────────
  {
    slug: "cowboy-locksmiths",
    name: "Cowboy Locksmiths",
    category: "generic",
    metaTitle:
      "A Safe Alternative to Cowboy Locksmiths — Verified & Documented | LockSafe UK",
    metaDescription:
      "Worried about rogue or 'cowboy' locksmiths and surprise bills? LockSafe shows the full price before work starts, uses only DBS-checked locksmiths, and documents every job. Free for customers.",
    keywords: [
      "cowboy locksmith",
      "avoid locksmith scams",
      "locksmith scam protection",
      "trusted locksmith alternative",
      "rogue locksmith",
      "locksmith rip off",
    ],
    heroIntro:
      "The anti-scam way to book a locksmith: verified pros, the price agreed before work starts, and proof of everything.",
    whatTheyAre:
      '"Cowboy" locksmiths are untrained or dishonest traders who quote one price and charge another, do unnecessary work, or can\'t be held to account afterwards. LockSafe is built specifically to make that impossible.',
    body: [
      "The classic scam is a £50 quote on the phone that becomes £300 at the door, with no paperwork and no recourse. LockSafe removes every step of that: locksmiths are verified before they can take a job, the full quote is shown and approved before any work begins, and the whole visit is documented.",
      "If a locksmith doesn't arrive within the agreed time, you're refunded automatically. If anything is ever disputed, you have GPS data, timestamped photos, a digital signature and a PDF report — proof rather than your word against theirs.",
      "It's the same fast, 24/7 emergency response you'd expect — without the risk of being overcharged or strong-armed at your own front door.",
    ],
    comparison: [
      {
        dimension: "Verification",
        them: "Often none — anyone can advertise",
        lockSafe: "DBS-checked, insured, ID-verified locksmiths",
      },
      {
        dimension: "The price",
        them: "Quote on the phone, more at the door",
        lockSafe: "Full itemised quote approved before work starts",
      },
      {
        dimension: "Pressure",
        them: "Upsells and on-the-spot pressure",
        lockSafe: "Decline the quote and pay only the assessment fee",
      },
      {
        dimension: "Proof",
        them: "No documentation",
        lockSafe: "GPS, photos, signature and PDF report every job",
      },
      {
        dimension: "If they don't show",
        them: "Money and time lost",
        lockSafe: "Automatic refund",
      },
    ],
    whyLockSafe: LOCKSAFE_DIFFERENTIATORS,
    faqs: [
      {
        q: "How do I avoid being scammed by a locksmith?",
        a: "Use a verified locksmith, get the full price in writing before any work starts, and make sure the job is documented. LockSafe builds all three into every booking by default.",
      },
      {
        q: "What stops a LockSafe locksmith overcharging?",
        a: "You approve a fixed, itemised quote before work begins. The price you accept is the price you pay — no doorstep upsells.",
      },
      {
        q: "What if I'm not happy with the quote?",
        a: "You can decline it and pay only the assessment fee you agreed upfront. There's no obligation to proceed.",
      },
    ],
  },
]);

export const COMPETITOR_ALTERNATIVES = COMPETITORS;

export function getAllCompetitorSlugs(): string[] {
  return COMPETITORS.map((c) => c.slug);
}

export function getCompetitorBySlug(
  slug: string,
): CompetitorAlternative | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export function getCompetitorsByCategory(
  category: CompetitorCategory,
): CompetitorAlternative[] {
  return COMPETITORS.filter((c) => c.category === category);
}

export const CATEGORY_LABELS: Record<CompetitorCategory, string> = {
  chain: "National locksmith chains",
  directory: "Directories & lead sites",
  generic: "Avoiding locksmith scams",
};
