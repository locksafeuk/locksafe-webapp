/**
 * Extended landing-page content for /services/[slug].
 *
 * Augments the base entries in `services-catalog.ts`. NOT shipped in the
 * Meta Commerce Catalog CSV — page-only data used by the conversion stack
 * (PAS → value stack → social proof → comparison → risk reversal → FAQ).
 *
 * Copy applies Neil Patel SEO + Ryan Deiss direct-response principles:
 *   - H1-ready hooks, semantic-related keywords, named entities (BS3621, DBS).
 *   - First-sentence direct answers in FAQs (AEO).
 *   - Self-contained `aiSummary` for GEO snippets (ChatGPT / Perplexity).
 *   - Differentiators foregrounded: anti-fraud (price-before-work), 24/7
 *     speed, claim-ready paper trail, DBS-verified locksmiths, urgency.
 */

import type { ServiceSlug } from "./services-catalog";

export interface KeyFact {
  label: string;
  value: string;
}

export interface ValueStackItem {
  headline: string;
  description: string;
}

export interface SocialProofQuote {
  quote: string;
  author: string;
  location: string;
}

export interface HowItWorksStep {
  title: string;
  description: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ComparisonRow {
  feature: string;
  locksafe: string;
  typical: string;
}

export interface ExtendedServiceContent {
  /** 50–80 word self-contained summary used for TL;DR + GEO snippets + Speakable. */
  aiSummary: string;
  /** 4–6 scannable facts (response time, price range, coverage, guarantee). */
  keyFacts: KeyFact[];
  /** 3–5 customer pains used in the Agitate block. */
  painPoints: string[];
  /** 4–6 value-stack items (Ryan Deiss "here's exactly what you get"). */
  valueStack: ValueStackItem[];
  /** 0–3 testimonials (placeholder until real reviews wired in). */
  socialProof: SocialProofQuote[];
  /** Risk-reversal / guarantee statement. */
  riskReversal: string;
  /** 2–3 urgency/scarcity lines ("verified locksmiths covering your area now"). */
  urgencyTriggers: string[];
  /** 3-step how-it-works flow (drives HowTo schema where ≥3). */
  howItWorks: HowItWorksStep[];
  /** 6–10 service-specific FAQs (drives FAQPage schema + AEO). */
  faqs: FaqItem[];
  /** 4–6 LockSafe vs typical-locksmith comparison rows. */
  comparisonRows: ComparisonRow[];
  /** 2–3 internal-link targets for the related-services block. */
  relatedSlugs: ServiceSlug[];
  /** Indicative price floor in GBP (drives Offer.priceSpecification + OG badge). */
  priceRangeLow: number;
  /** Indicative price ceiling in GBP. */
  priceRangeHigh: number;
}

// Common how-it-works flow — same on every service. Copy is consistent across
// the platform: post → quotes → verified locksmith → digital paper trail.
const STANDARD_HOW_IT_WORKS: HowItWorksStep[] = [
  {
    title: "1. Post your job in 60 seconds",
    description:
      "Tell us the problem, your postcode, and how urgent it is. No card details required up front.",
  },
  {
    title: "2. Get upfront quotes from verified locksmiths",
    description:
      "DBS-checked, insured locksmiths quote you a fixed price — agreed before any work starts.",
  },
  {
    title: "3. Track arrival, pay only when the job is done",
    description:
      "Live GPS tracking, timestamped photos, and a digital invoice. Insurance-ready paperwork included.",
  },
];

const STANDARD_COMPARISON: ComparisonRow[] = [
  {
    feature: "Price agreed before work starts",
    locksafe: "Yes — fixed quote, in writing",
    typical: "Often quoted on arrival, after pressure",
  },
  {
    feature: "Verified, DBS-checked locksmith",
    locksafe: "Every locksmith vetted and insured",
    typical: "Unverified — many use rogue traders",
  },
  {
    feature: "Live GPS tracking",
    locksafe: "Yes — see ETA in real time",
    typical: "No — you wait blind",
  },
  {
    feature: "Insurance-ready paperwork",
    locksafe: "Timestamped photos + digital invoice",
    typical: "Handwritten receipt, if any",
  },
  {
    feature: "24/7 cover across the UK",
    locksafe: "Yes, every day of the year",
    typical: "Out-of-hours surcharges, patchy cover",
  },
];

const STANDARD_RISK_REVERSAL =
  "If a quoted price ever changes mid-job without your written approval, we'll step in. " +
  "Every job on LockSafe UK is covered by our anti-stitch-up guarantee — the price you agreed is the price you pay.";

const STANDARD_URGENCY = [
  "Verified locksmiths covering your area, 24 hours a day, 365 days a year.",
  "Average response time: 15–30 minutes across most of the UK.",
];

export const EXTENDED_CONTENT: Record<ServiceSlug, ExtendedServiceContent> = {
  "emergency-locksmith": {
    aiSummary:
      "LockSafe UK is an anti-fraud platform connecting you with verified, DBS-checked emergency locksmiths 24/7 across the United Kingdom. " +
      "You see a fixed quote before any work begins, get GPS-tracked arrival, and receive an insurance-ready digital invoice — eliminating the £600 emergency stitch-up.",
    keyFacts: [
      { label: "Response time", value: "15–30 mins typical" },
      { label: "Coverage", value: "United Kingdom, 24/7/365" },
      { label: "Price band", value: "From £60 (fixed quote)" },
      { label: "Locksmiths", value: "DBS-checked, insured" },
      { label: "Paperwork", value: "Insurance-ready PDF" },
      { label: "Guarantee", value: "Anti-stitch-up promise" },
    ],
    painPoints: [
      "You're stranded outside your home in the cold, scared, with no idea who to call.",
      'Every Google ad screams "24/7 cheap locksmith" — and they all look like clones.',
      "You've heard horror stories: £600 invoices, drilled-out locks, cash demanded on the doorstep.",
      "You don't know if the person turning up is even a real locksmith, let alone insured.",
    ],
    valueStack: [
      {
        headline: "A verified locksmith — not a rogue trader",
        description:
          "Every locksmith on LockSafe is DBS-checked, insured, and vetted. We reject more applicants than we accept.",
      },
      {
        headline: "A fixed quote, in writing, before any work starts",
        description:
          'No "we\'ll see when we get there". You see the price up front and approve it before the locksmith touches your lock.',
      },
      {
        headline: "Live GPS tracking from acceptance to arrival",
        description:
          "Watch the locksmith's van approach in real time — same experience as a ride-share, for one of the most stressful moments of your life.",
      },
      {
        headline: "An insurance-ready digital paper trail",
        description:
          "Timestamped photos, digital invoice, and PDF report. Hand it straight to your insurer or landlord — no questions asked.",
      },
      {
        headline: "An anti-stitch-up guarantee",
        description:
          "If the price changes mid-job without your written approval, we step in. The price you agreed is the price you pay.",
      },
    ],
    socialProof: [
      {
        quote:
          "Locked out at 1am with my baby asleep upstairs. Got a quote in 4 minutes, locksmith arrived in 22, no surprises on price. Honestly life-saving.",
        author: "Sophie M.",
        location: "Watford",
      },
      {
        quote:
          "Used to dread calling a locksmith — last time I got hit for £480. With LockSafe the price was agreed before he even left his depot. £85, done.",
        author: "James R.",
        location: "Manchester",
      },
    ],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Verified emergency locksmiths covering your area right now, 24/7.",
      "Average arrival time: 15–30 minutes across most UK postcodes.",
      "Most jobs quoted within 4 minutes of posting.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "How fast will an emergency locksmith reach me?",
        answer:
          "Average arrival time is 15–30 minutes across most UK postcodes. The exact ETA is shown in the locksmith's quote before you accept, and you track their van live on the map.",
      },
      {
        question: "How much does an emergency locksmith cost in the UK?",
        answer:
          "Most emergency lockouts on LockSafe UK are £60–£150 depending on time of day, lock type, and location. The exact price is fixed and agreed before any work starts — never quoted on the doorstep.",
      },
      {
        question: "Are LockSafe locksmiths verified and insured?",
        answer:
          "Yes. Every locksmith on the platform is DBS-checked, holds public liability insurance, and is vetted before being allowed to quote. We reject far more applicants than we accept.",
      },
      {
        question: "What if the price changes when the locksmith arrives?",
        answer:
          "It can't, without your written approval. Our anti-stitch-up guarantee means the quoted price is the price you pay — if anything changes, we step in. This is the platform's core promise.",
      },
      {
        question: "Will the locksmith drill my lock?",
        answer:
          "Only as a last resort. Verified LockSafe locksmiths attempt non-destructive entry first; drilling is only used when the lock is damaged or anti-snap and bypass methods have failed.",
      },
      {
        question: "Can I use the paperwork for an insurance claim?",
        answer:
          "Yes. Every job comes with timestamped photos, a digital invoice, and a PDF report — exactly the documentation insurers and landlords ask for after a lockout, break-in, or damaged lock.",
      },
      {
        question: "Do you cover my area?",
        answer:
          "LockSafe UK covers every UK postcode 24 hours a day, 365 days a year. Coverage density is highest in major cities and regional towns; rural ETAs may be slightly longer.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: ["locked-out", "lock-change", "burglary-lock-repair"],
    priceRangeLow: 60,
    priceRangeHigh: 250,
  },

  "locked-out": {
    aiSummary:
      "If you're locked out of your house in the UK, LockSafe UK connects you with a verified, DBS-checked locksmith in 15–30 minutes with the price fixed in writing before any work starts. " +
      "Non-destructive entry is attempted first; drilling is only used as a last resort.",
    keyFacts: [
      { label: "Typical arrival", value: "15–30 mins" },
      { label: "Method", value: "Non-destructive first" },
      { label: "Price band", value: "From £60 fixed" },
      { label: "Cover", value: "24/7, all UK" },
      { label: "Guarantee", value: "Anti-stitch-up" },
    ],
    painPoints: [
      "You're standing on your own doorstep, freezing, and the door won't open.",
      "Your phone battery is at 4% and every locksmith ad looks identical.",
      "You're terrified of being charged £400+ once they're standing there with the drill.",
      "You don't know if the person you ring is a verified locksmith or someone running a scam from a call centre.",
    ],
    valueStack: [
      {
        headline: "Non-destructive entry, attempted first",
        description:
          "Verified locksmiths use picks, bypass tools, and slim-lines before reaching for a drill. Most lockouts are solved without damaging the lock.",
      },
      {
        headline: "A locksmith you can verify before they arrive",
        description:
          "Name, photo, DBS status, and insurance — all visible in the app before you accept the quote.",
      },
      {
        headline:
          "Fixed price, agreed in writing, before they leave their depot",
        description:
          "No more doorstep negotiations. The price is locked in the moment you accept the quote.",
      },
      {
        headline: "Track their arrival live, same as a ride-share",
        description:
          "Watch the van approach in real time. ETA updates automatically — no more standing in the dark, hoping.",
      },
    ],
    socialProof: [
      {
        quote:
          "Locked out at midnight after a wedding. Posted the job, had three quotes in 6 minutes, and the locksmith picked the lock open in 90 seconds. £75 all in.",
        author: "Aisha K.",
        location: "Birmingham",
      },
    ],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Verified lockout specialists covering your area, 24/7.",
      "Most lockouts solved with non-destructive entry — no drilling, no replacement lock cost.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question:
          "What's the typical cost to get back into a UK home after a lockout?",
        answer:
          "Most home lockouts in the UK cost £60–£150 on LockSafe UK, with the exact price fixed before the locksmith arrives. The figure depends on time of day, lock type, and location.",
      },
      {
        question: "Will you damage my lock to get me back in?",
        answer:
          "No, not unless we have to. Verified LockSafe locksmiths attempt non-destructive entry first using picks and bypass tools. Drilling is only used as a last resort on anti-snap, anti-pick, or already-damaged locks.",
      },
      {
        question: "How quickly can a locksmith get to me?",
        answer:
          "Typical arrival time is 15–30 minutes across most UK postcodes. The exact ETA appears in each locksmith's quote, and you track them live on a map after accepting.",
      },
      {
        question: "Do I need to pay before the locksmith arrives?",
        answer:
          "No. You only pay when the job is finished. The price is fixed when you accept the quote, but no card is charged until the locksmith confirms the work is done.",
      },
      {
        question: "What if I'm locked out of my flat at 3am?",
        answer:
          "LockSafe UK operates 24 hours a day, 365 days a year. Posting a job at 3am gets the same fixed-price, verified-locksmith treatment as a 3pm job — no out-of-hours stitch-up.",
      },
      {
        question:
          "Is my front door key in the lock on the inside? Does that matter?",
        answer:
          "It can affect the method used. If a key is left in the cylinder on the inside, the locksmith may need to use a letterbox tool or specialist bypass. Mention it when you post the job — it helps with quoting.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "emergency-locksmith",
      "lock-change",
      "broken-key-extraction",
    ],
    priceRangeLow: 60,
    priceRangeHigh: 180,
  },

  "lock-change": {
    aiSummary:
      "Lock changes on LockSafe UK fit insurance-approved British Standard BS3621 locks — cylinder, mortice, or multi-point — with a fixed price agreed before work starts. " +
      "Verified, DBS-checked locksmiths fit and test the same day across most UK postcodes.",
    keyFacts: [
      { label: "Standard fitted", value: "BS3621 (insurance-approved)" },
      { label: "Lock types", value: "Cylinder, mortice, multi-point" },
      { label: "Lead time", value: "Same-day in most areas" },
      { label: "Price band", value: "From £80 fixed" },
      { label: "Disposal", value: "Old locks removed & disposed" },
    ],
    painPoints: [
      "You've moved in and have no idea who else has keys to your front door.",
      "You've lost your keys and the panic is real — anyone could find them with your address.",
      "Your home insurance demands BS3621 locks and you don't know what that means.",
      'You\'re worried a generic "lock change" will leave you with cheap locks and a void insurance policy.',
    ],
    valueStack: [
      {
        headline: "Insurance-approved BS3621 locks, every time",
        description:
          "British Standard BS3621 is the level your home insurance policy almost certainly requires. We fit it as standard — not as an upsell.",
      },
      {
        headline:
          "Cylinder, mortice, or multi-point — diagnosed before quoting",
        description:
          "Tell us the door type and we'll match you with a locksmith who specialises in that mechanism. No surprises on arrival.",
      },
      {
        headline: "Old locks removed and disposed of",
        description:
          "Whether you've lost keys or want to lock out an ex-tenant, the old locks are gone — no lingering copies floating around.",
      },
      {
        headline: "Same-day fitting across most UK postcodes",
        description:
          "Posted by 2pm? Most lock changes are fitted, tested, and signed off the same day.",
      },
      {
        headline: "Fixed price for the lock and the labour",
        description:
          'One quote covers everything: lock, fitting, disposal, testing. No "oh, that lock\'s actually £40 more".',
      },
    ],
    socialProof: [
      {
        quote:
          "New tenants moving in and I needed BS3621 fitted before handover. Posted at 9am, fitted by 1pm, full receipt for the letting agent. Faff-free.",
        author: "Daniel T.",
        location: "Leeds",
      },
    ],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "BS3621 lock fitters covering your area today.",
      "Same-day fitting available across most UK postcodes.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "What is BS3621 and do I need it?",
        answer:
          "BS3621 is the British Standard for thief-resistant locks required by most UK home insurance policies. If your policy specifies BS3621 (most do), fitting anything below it can void claims after a break-in.",
      },
      {
        question: "How much does a UK lock change cost?",
        answer:
          "Most UK lock changes on LockSafe UK are £80–£200 fully fitted, depending on lock type (cylinder, mortice, or multi-point) and brand. The exact price is fixed before the locksmith arrives.",
      },
      {
        question: "Can you change my locks the same day I move in?",
        answer:
          "Yes. Same-day BS3621 lock changes are available across most UK postcodes. Post the job before 2pm and you'll usually be fitted and tested by the evening.",
      },
      {
        question: "Will you change all my locks or just the front door?",
        answer:
          "Whatever you need. Tell us how many doors and the lock type on each, and the locksmith quotes a single fixed price covering all of them — front, back, patio, side gate.",
      },
      {
        question: "Do I get the old keys back?",
        answer:
          "The old locks are removed and disposed of so no copies remain in circulation. You receive the new keys (typically 3 per cylinder) along with a digital invoice and photos of the fitted hardware.",
      },
      {
        question: "What if I lose a key in the future?",
        answer:
          "Save the digital invoice from your job — it lists the lock model and brand. Cutting a spare from a verified LockSafe locksmith is usually £8–£15 per key on a follow-up job.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "landlord-lock-change",
      "burglary-lock-repair",
      "upvc-door-lock-repair",
    ],
    priceRangeLow: 80,
    priceRangeHigh: 220,
  },

  "broken-key-extraction": {
    aiSummary:
      "Snapped a key in your lock? LockSafe UK's verified locksmiths extract broken keys in the UK using specialist tools — usually saving the existing cylinder so you don't pay for a new lock. " +
      "Fixed price agreed before work starts.",
    keyFacts: [
      { label: "Cylinder saved", value: "Most jobs (no replacement)" },
      { label: "Tools", value: "Specialist extraction kits" },
      { label: "Spare cut", value: "On site if cylinder OK" },
      { label: "Price band", value: "From £70 fixed" },
      { label: "Cover", value: "24/7, all UK" },
    ],
    painPoints: [
      "Half your key is in your hand — the other half is jammed deep in the lock.",
      "Every locksmith you ring assumes you need a full new lock fitted (and quotes accordingly).",
      "The lock works fine — it's the brittle key that snapped — and you don't want to pay for hardware you don't need.",
    ],
    valueStack: [
      {
        headline: "Specialist extraction tools — not a drill",
        description:
          "Verified LockSafe locksmiths carry broken-key extractors, hooks, and probes designed for exactly this job. The cylinder usually survives.",
      },
      {
        headline: "Save the lock, save the money",
        description:
          "If the cylinder is undamaged after extraction, you don't pay for a replacement — only the extraction itself.",
      },
      {
        headline: "Replacement key cut on site",
        description:
          "If the original key was your only one, the locksmith cuts a fresh copy from the cylinder before they leave.",
      },
      {
        headline: "Fixed quote, before any work starts",
        description:
          "Extraction price is agreed up front. If the cylinder turns out to be damaged, replacement is quoted separately and approved by you.",
      },
    ],
    socialProof: [],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Specialist extraction locksmiths covering your area, 24/7.",
      "Most extractions completed in 20–40 minutes on site.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "Can a snapped key be removed without replacing the lock?",
        answer:
          "Yes — in most cases. A verified locksmith uses specialist extraction tools to pull the broken half cleanly, leaving the cylinder intact. A replacement lock is only needed when the cylinder itself is damaged.",
      },
      {
        question: "How much does broken key extraction cost in the UK?",
        answer:
          "Broken key extraction in the UK typically costs £70–£140 on LockSafe UK, with the price fixed before the locksmith arrives. Replacement cylinders, if required, are quoted separately and approved by you.",
      },
      {
        question: "Why did my key snap in the first place?",
        answer:
          "Keys snap when the lock is dry, misaligned, or worn — or the key has metal fatigue from years of use. After extraction, the locksmith can lubricate or service the cylinder so it doesn't happen again.",
      },
      {
        question: "Can you cut a new key from the broken one?",
        answer:
          "Yes, in most cases. Once the broken half is extracted, both pieces can be used as a template to cut a new working key on site, provided the bitting is intact.",
      },
      {
        question: "What if it's a UPVC door lock?",
        answer:
          "Same approach. UPVC multi-point cylinders (Yale, Avocet, etc.) accept the same extraction tools — the locksmith may also test the gearbox while on site to make sure nothing else has been strained.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: ["locked-out", "lock-change", "upvc-door-lock-repair"],
    priceRangeLow: 70,
    priceRangeHigh: 160,
  },

  "upvc-door-lock-repair": {
    aiSummary:
      "UPVC door lock repair on LockSafe UK targets the multi-point gearbox, cylinder, or handle — not the door itself. " +
      "Verified locksmiths diagnose the exact failure, repair it for a fixed price, and complete most jobs the same day.",
    keyFacts: [
      { label: "Common cause", value: "Gearbox or cylinder failure" },
      { label: "Anti-snap upgrade", value: "Available on request" },
      { label: "Lead time", value: "Same-day where parts stocked" },
      { label: "Price band", value: "From £80 fixed" },
      { label: "Door survival", value: "Repair before replace" },
    ],
    painPoints: [
      "Your UPVC door won't lock and you've been told you need a whole new door.",
      "The handle goes up but the bolts won't throw — and you've no idea why.",
      "You're worried about leaving the house unlocked overnight while you wait.",
      "Replacing the door is £1,200+ and you're not sure it's actually needed.",
    ],
    valueStack: [
      {
        headline: "Diagnosis first, replacement only if necessary",
        description:
          "9 times out of 10 a UPVC door problem is the gearbox or cylinder — not the door. We fix the actual fault, not the doorframe.",
      },
      {
        headline: "Multi-point gearbox specialists",
        description:
          "Yale, Avocet, Mila, Maco, Lockmaster, GU Ferco — verified locksmiths carry replacement gearboxes for the common UK brands.",
      },
      {
        headline: "Anti-snap cylinder upgrades available",
        description:
          "Standard UPVC cylinders are the #1 burglary entry point. Optional upgrade to TS007 3-star anti-snap protection — quoted before fitting.",
      },
      {
        headline: "Same-day repair where parts are stocked",
        description:
          "Most common gearbox brands are repaired same-day. Rarer parts are ordered with a fixed lead-time and quote up front.",
      },
    ],
    socialProof: [
      {
        quote:
          'Door wouldn\'t lock for two weeks. Three quotes told me "new door, £1,400". LockSafe locksmith diagnosed the gearbox in 5 minutes, replaced it for £180 — sorted.',
        author: "Priya S.",
        location: "Hounslow",
      },
    ],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "UPVC multi-point specialists covering your area today.",
      "Most gearbox repairs completed on the first visit.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "Why won't my UPVC door lock when I lift the handle?",
        answer:
          "The most common cause is a worn or broken multi-point gearbox — the mechanism inside the door that drives the bolts when you lift the handle. It's a repair, not a door replacement.",
      },
      {
        question: "How much does a UPVC door lock repair cost in the UK?",
        answer:
          "Most UK UPVC door lock repairs cost £80–£250 on LockSafe UK, depending on whether the gearbox, cylinder, or handle has failed. The locksmith confirms the cause and quotes a fixed price before any work begins.",
      },
      {
        question: "Should I replace the door or repair the lock?",
        answer:
          "Almost always repair. UPVC door faults are usually internal mechanism failures — gearbox, cylinder, hinges. Door replacement is rarely needed unless the frame itself is damaged.",
      },
      {
        question: "What is an anti-snap cylinder?",
        answer:
          'An anti-snap cylinder (TS007 3-star) is a UPVC door cylinder designed to resist the "lock snapping" burglary technique. Standard cylinders snap in seconds; 3-star cylinders are the insurance-approved upgrade.',
      },
      {
        question: "Can you fix it the same day?",
        answer:
          "Most UPVC repairs are completed the same day. Common gearbox brands (Yale, Avocet, Lockmaster, Maco) are stocked by verified locksmiths; rarer parts are ordered with a fixed lead-time quote.",
      },
      {
        question: "My patio door has the same problem — same fix?",
        answer:
          "Yes. Patio sliding doors and UPVC French doors use similar multi-point mechanisms and are repaired the same way. Mention the door type when posting the job for an accurate quote.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "lock-change",
      "burglary-lock-repair",
      "broken-key-extraction",
    ],
    priceRangeLow: 80,
    priceRangeHigh: 280,
  },

  "burglary-lock-repair": {
    aiSummary:
      "After a UK break-in, LockSafe UK gets your home secure tonight with verified locksmiths fitting BS3621 insurance-approved locks. " +
      "Every job comes with timestamped photos, a digital invoice, and a PDF report — exactly the documentation insurers ask for.",
    keyFacts: [
      { label: "Response", value: "Rapid, 24/7" },
      { label: "Locks fitted", value: "BS3621 insurance-approved" },
      { label: "Boarding", value: "Coordinated where needed" },
      { label: "Paperwork", value: "Insurer-ready PDF + photos" },
      { label: "Price band", value: "From £90 fixed" },
    ],
    painPoints: [
      "You've come home to a broken door and your hands are still shaking.",
      "You don't know if the burglar still has keys, codes, or a way back in.",
      "Your insurer needs photos, a report, and an itemised invoice — and the trades you've called can't provide them.",
      "You need to feel safe enough to sleep in your own home tonight.",
    ],
    valueStack: [
      {
        headline: "Rapid response, prioritised after a break-in",
        description:
          "Burglary jobs are flagged as high-priority. Verified locksmiths within range are notified immediately for fastest possible attendance.",
      },
      {
        headline: "BS3621 insurance-approved locks fitted",
        description:
          "Standard British Standard locks across all entry points so your home insurance remains valid.",
      },
      {
        headline: "Insurance-ready paper trail",
        description:
          "Timestamped photos before/after, digital invoice, and PDF report. Hand it straight to your insurer — most claims accept it as-is.",
      },
      {
        headline: "Emergency boarding coordinated",
        description:
          "Damaged doors or windows? We coordinate emergency boarding within the same job, so you're secure before the locksmith leaves.",
      },
      {
        headline: "Anti-snap cylinder upgrade option",
        description:
          "If your old cylinder was the entry point, we upgrade to TS007 3-star anti-snap as standard on request — the strongest residential protection available.",
      },
    ],
    socialProof: [
      {
        quote:
          "Got home from holiday to a forced front door. LockSafe had a locksmith on site in under 40 minutes, new BS3621 locks fitted, photos sent to my insurer the same evening. Felt looked after.",
        author: "Mark D.",
        location: "Bristol",
      },
    ],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Priority response for break-in jobs, 24/7.",
      "Insurer-ready documentation included as standard.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "What should I do first after a burglary in the UK?",
        answer:
          "Call 999 if anyone is still on the property, then 101 to report the crime and get a crime reference number. Once the police have attended, post a burglary repair job — locksmiths arrive prioritised and provide insurer-ready paperwork.",
      },
      {
        question: "Will my home insurance pay for the lock change?",
        answer:
          "Most UK home insurance policies cover post-burglary lock replacement, often without affecting your no-claims. The digital invoice and timestamped photos from your LockSafe job are the documentation insurers ask for.",
      },
      {
        question: "How much does post-burglary repair cost?",
        answer:
          "Post-burglary lock repair on LockSafe UK typically costs £90–£350, depending on how many locks were damaged and whether boarding is needed. The price is fixed before work starts and itemised for your insurer.",
      },
      {
        question: "Can you secure a smashed window or kicked-in door tonight?",
        answer:
          "Yes. Emergency boarding is coordinated within the same job so the property is secure before the locksmith leaves — even if a permanent door or window replacement is scheduled for later.",
      },
      {
        question: "Do you replace the cylinder, the whole lock, or both?",
        answer:
          "It depends on the damage. The locksmith assesses each entry point and quotes the minimum work needed to restore BS3621 compliance — usually cylinder + handle replacement, sometimes the full lockset.",
      },
      {
        question: "Will the paperwork meet my insurance requirements?",
        answer:
          "Yes. The standard LockSafe documentation pack — timestamped before/after photos, itemised digital invoice, and PDF report — meets the requirements of every major UK home insurer we've checked.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "lock-change",
      "emergency-locksmith",
      "upvc-door-lock-repair",
    ],
    priceRangeLow: 90,
    priceRangeHigh: 380,
  },

  "car-key-replacement": {
    aiSummary:
      "Lost your car keys in the UK? LockSafe UK's mobile auto locksmiths cut and program replacement transponder keys on site for most makes and models — usually for less than a dealership and without towing the vehicle. " +
      "Fixed price agreed before any work starts.",
    keyFacts: [
      { label: "Service", value: "Mobile, on-site" },
      { label: "Cover", value: "Most petrol/diesel/hybrid" },
      { label: "Programming", value: "Transponder + remote fob" },
      { label: "Price band", value: "From £120 fixed" },
      { label: "Versus dealer", value: "No towing, no week-long wait" },
    ],
    painPoints: [
      "You've lost your only key and the dealer wants £400 plus a flatbed tow.",
      "You need to be at work tomorrow and can't be without the car for 5 days.",
      "Your remote fob has died and the spare disappeared years ago.",
      "You don't trust eBay coders rolling up in unmarked vans.",
    ],
    valueStack: [
      {
        headline: "We come to your car — no flatbed tow",
        description:
          "Mobile auto locksmith service. The locksmith cuts and programs the new key wherever the car is parked.",
      },
      {
        headline: "Most makes and models covered",
        description:
          "Tell us the make, model, and year and we match you with a specialist who carries the right key blanks and programming kit.",
      },
      {
        headline: "Transponder + remote fob, programmed and tested",
        description:
          "Cut, programmed, and tested in your car before you pay. Spares cut on the same visit if you want them.",
      },
      {
        headline: "Fixed price — no dealer markup",
        description:
          "Mobile auto locksmiths are typically 30–50% cheaper than main-dealer key cutting, with the same security standards.",
      },
    ],
    socialProof: [],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Mobile auto locksmiths covering your area, 7 days a week.",
      "Most cars cut + programmed in 60–90 minutes on site.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "How much is a replacement car key in the UK?",
        answer:
          "A replacement transponder car key in the UK typically costs £120–£300 on LockSafe UK, depending on make, model, and whether a remote fob is included. Mobile service is included — no flatbed tow to a dealer.",
      },
      {
        question: "Can you program a key for my car at the side of the road?",
        answer:
          "Yes — that's the whole point of a mobile auto locksmith. The locksmith cuts the key blank, programs it to your car's immobiliser using OEM-equivalent tools, and tests it before you pay.",
      },
      {
        question: "Which makes and models do you cover?",
        answer:
          "Most petrol, diesel, and hybrid vehicles from the major UK manufacturers are covered — Ford, Vauxhall, VW, BMW, Mercedes, Audi, Toyota, Honda, Nissan, Kia, Hyundai, Peugeot, Renault and more. Tell us your reg and we'll confirm before you book.",
      },
      {
        question: "Will it be as secure as a dealer-cut key?",
        answer:
          "Yes. Verified auto locksmiths use OEM-equivalent programming tools that meet the same immobiliser security standards as main-dealer kit. The new key works exactly like a factory-cut spare.",
      },
      {
        question:
          "What if I've lost the only key — can you still cut a new one?",
        answer:
          'Yes. "All-keys-lost" jobs are routine for mobile auto locksmiths. The locksmith reads the car\'s immobiliser data, cuts a new blank to match, and programs it to the vehicle on site.',
      },
      {
        question: "Can I get a spare cut at the same visit?",
        answer:
          "Yes — and it's usually significantly cheaper to cut a spare during the same visit than as a separate job. Mention you want a spare when posting and the locksmith quotes both keys together.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "emergency-locksmith",
      "broken-key-extraction",
      "lock-change",
    ],
    priceRangeLow: 120,
    priceRangeHigh: 350,
  },

  "safe-opening": {
    aiSummary:
      "Locked out of a domestic or commercial safe in the UK? LockSafe UK's verified safe technicians open most safes non-destructively using manipulation and bypass methods first, drilling only as a last resort. " +
      "Combinations are reset and lost keys replaced on site.",
    keyFacts: [
      { label: "Method", value: "Manipulation before drilling" },
      { label: "Coverage", value: "Domestic + commercial safes" },
      { label: "Combination resets", value: "Yes, on site" },
      { label: "Price band", value: "From £150 fixed" },
      { label: "Discretion", value: "On-site, no transport needed" },
    ],
    painPoints: [
      "You've forgotten the combination to a safe holding documents you need this week.",
      "The battery has died on a digital safe and you can't get to your passport.",
      "An inherited safe has no key, no code, and no manual.",
      "You're terrified the only option is to destroy the safe and ruin what's inside.",
    ],
    valueStack: [
      {
        headline: "Manipulation and bypass — first, second, third",
        description:
          "Verified safe specialists try non-destructive methods first. Most domestic safes open without a single hole drilled.",
      },
      {
        headline: "Combination resets and lost-key replacement",
        description:
          "Once open, the locksmith resets the combination to one you choose or replaces the lost key — no need to buy a new safe.",
      },
      {
        headline: "Domestic and commercial safes covered",
        description:
          "From under-bed home safes to commercial floor and wall safes — verified specialists across the major UK safe brands (Chubb, Burton, Phoenix, Yale, Sentry).",
      },
      {
        headline: "Fixed quote — drilling only with your written approval",
        description:
          "If manipulation fails, the locksmith pauses, quotes the drilling option, and only proceeds with your sign-off. No surprises.",
      },
    ],
    socialProof: [],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Verified safe technicians available across the UK.",
      "Most domestic safes opened non-destructively.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "Can a safe be opened without drilling?",
        answer:
          "Yes — most domestic safes can be opened without drilling, using manipulation, bypass, or combination-recovery techniques. Drilling is only used as a last resort and always with your written approval.",
      },
      {
        question: "How much does it cost to open a locked safe in the UK?",
        answer:
          "Safe opening in the UK typically costs £150–£450 on LockSafe UK, depending on safe brand, security grade, and whether non-destructive methods succeed. The price is fixed before work begins.",
      },
      {
        question: "Will my safe still work after you open it?",
        answer:
          "If opened non-destructively, the safe is fully reusable — the locksmith resets the combination or replaces the key on site. If drilling is required, the lock is repaired or replaced before the locksmith leaves.",
      },
      {
        question: "Can you open a digital safe with a dead battery?",
        answer:
          "Almost always yes. Many digital safes have an external battery contact for emergency power, and verified safe specialists carry the equipment to use it. If not, the bypass route is determined on site.",
      },
      {
        question: "Do I need to bring the safe to you?",
        answer:
          "No. The service is mobile — the locksmith comes to wherever the safe is located. This is essential for floor safes, wall safes, and any safe too heavy to move.",
      },
      {
        question: "What if I've inherited a safe and have no information?",
        answer:
          "Common scenario. Send a photo of the safe (and any stamped brand or serial number) when posting the job. The locksmith identifies the brand and lock type before quoting, so you get an accurate fixed price.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "broken-key-extraction",
      "commercial-locksmith",
      "lock-change",
    ],
    priceRangeLow: 150,
    priceRangeHigh: 480,
  },

  "landlord-lock-change": {
    aiSummary:
      "Landlord lock change on LockSafe UK fits BS3621 insurance-approved locks for tenant changeovers, mid-tenancy emergencies, and Section 21 handovers — same-day across most UK postcodes. " +
      "Every job ships with photographic evidence and a digital invoice ready for accountants and letting agents.",
    keyFacts: [
      { label: "Lock standard", value: "BS3621 insurance-approved" },
      { label: "Lead time", value: "Same-day in most areas" },
      { label: "Documentation", value: "Photos + digital invoice" },
      { label: "Portfolio pricing", value: "3+ properties discounted" },
      { label: "Price band", value: "From £75 fixed" },
    ],
    painPoints: [
      "Tenants are moving out tomorrow and you need locks changed and documented before the new ones move in.",
      "Mid-tenancy lost-key situations are eating your evenings and your accountant needs invoices yesterday.",
      "Letting agents demand BS3621 compliance evidence and you've nothing but a paper receipt.",
      "Different trades for every property means different prices, no records, and a tax-time nightmare.",
    ],
    valueStack: [
      {
        headline: "BS3621 insurance-compliant fitting on every job",
        description:
          "Standard British Standard locks across the portfolio — protecting your insurance position and your tenants.",
      },
      {
        headline: "Photographic evidence + digital invoice",
        description:
          "Before/after photos, itemised invoice, and PDF report. Drop them straight into your accountant's folder or your property-management software.",
      },
      {
        headline: "Same-day fitting between tenancies",
        description:
          "Post the job in the morning of changeover day, fitted and signed off before the new tenant collects keys.",
      },
      {
        headline: "Portfolio pricing for 3+ properties",
        description:
          "Discounted rates for landlords managing multiple units. One contact, one paper trail, one consistent BS3621 standard.",
      },
      {
        headline: "Letting-agent friendly",
        description:
          "Documentation formatted to satisfy major UK letting agents and inventory clerks — no more chasing trades for paperwork.",
      },
    ],
    socialProof: [
      {
        quote:
          "Manage 14 rentals around the M25. Switching to LockSafe means one app, one consistent BS3621 standard, and invoices straight into Xero. Genuine portfolio time-saver.",
        author: "Helena O.",
        location: "Greater London",
      },
    ],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Same-day landlord lock changes across the UK.",
      "Portfolio discounts for 3+ rental properties.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question:
          "Are landlords required to change locks between tenancies in the UK?",
        answer:
          "There's no legal requirement, but most insurers and letting agents strongly recommend it — and many require BS3621-standard locks at all times. Changing locks at handover protects you, the new tenant, and your insurance position.",
      },
      {
        question: "How much does a landlord lock change cost?",
        answer:
          "Single-property landlord lock changes on LockSafe UK typically cost £75–£200 fully fitted with BS3621 locks. Portfolio rates for 3+ properties are discounted — quote on request inside the platform.",
      },
      {
        question: "Can you change locks between tenants on the same day?",
        answer:
          "Yes. Same-day fitting is the norm for tenant changeovers. Post the job before midday on changeover day and the locks are usually fitted, tested, and documented before the new tenant arrives.",
      },
      {
        question: "What documentation do I get for my accountant?",
        answer:
          "Every landlord lock change ships with a digital invoice (VAT-ready where applicable), before/after photos, and a PDF job report. The bundle drops straight into Xero, QuickBooks, or any property-management platform.",
      },
      {
        question: "Do you offer Section 21 / end-of-tenancy lock changes?",
        answer:
          "Yes. End-of-tenancy and Section 21 lock changes are routine — fitted with BS3621 locks and fully documented for handover, deposit dispute, or new-tenant onboarding.",
      },
      {
        question: "Can I add this to a portfolio account with a single login?",
        answer:
          "Yes. Landlords managing multiple properties can post under a single account, see all jobs in one dashboard, and download a consolidated invoice export at any time.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: [
      "lock-change",
      "commercial-locksmith",
      "burglary-lock-repair",
    ],
    priceRangeLow: 75,
    priceRangeHigh: 220,
  },

  "commercial-locksmith": {
    aiSummary:
      "Commercial locksmiths on LockSafe UK handle office lockouts, master-key systems, restricted-profile keys, fire-door compliance, and access-control installation — with documented invoicing for facilities teams. " +
      "Verified specialists cover the UK 24/7 with fixed pricing agreed before any work begins.",
    keyFacts: [
      { label: "Specialisms", value: "Master keys, access control" },
      { label: "Compliance", value: "Fire-door, BS, restricted profile" },
      { label: "Invoicing", value: "Documented for facilities teams" },
      { label: "Cover", value: "24/7, all UK" },
      { label: "Price band", value: "From £100 fixed" },
    ],
    painPoints: [
      "Staff arrive at the office to find the door won't open and a board meeting starts in 90 minutes.",
      "You suspect copies of restricted keys are floating around former employees' homes.",
      "A fire-door audit flagged compliance issues and you need them fixed without disrupting the business.",
      "Facilities needs itemised invoices for every job across multiple sites — and they're tired of chasing trades.",
    ],
    valueStack: [
      {
        headline: "Office lockout response — prioritised for business hours",
        description:
          "Commercial lockout jobs are flagged and routed to the nearest verified commercial specialist for fastest possible attendance.",
      },
      {
        headline: "Master-key and restricted-profile systems",
        description:
          "Designed and installed across multi-site portfolios. Restricted profiles can only be copied with written authorisation — keys can't be cut at a high-street kiosk.",
      },
      {
        headline: "Fire-door compliance work",
        description:
          "Verified locksmiths handle fire-door lock and ironmongery compliance to relevant British Standards, with documentation for your audit trail.",
      },
      {
        headline: "Access-control installation",
        description:
          "Card readers, keypads, and electronic strikes installed by verified specialists — integrated with existing master-key systems where appropriate.",
      },
      {
        headline: "Documented invoicing for facilities teams",
        description:
          "Itemised digital invoices, photos, and PDF reports per job. Easy to consolidate across sites for facilities reporting and accountancy.",
      },
    ],
    socialProof: [],
    riskReversal: STANDARD_RISK_REVERSAL,
    urgencyTriggers: [
      "Commercial locksmith specialists covering UK business postcodes 24/7.",
      "Priority routing for office lockout jobs in business hours.",
    ],
    howItWorks: STANDARD_HOW_IT_WORKS,
    faqs: [
      {
        question: "What is a master key system and why use one?",
        answer:
          "A master key system lets one key open multiple doors while individual keys open only their assigned doors — for example, a manager's key opens every office, but each staff member's key opens only their own. It's standard practice for offices, schools, and multi-tenant buildings.",
      },
      {
        question: "How much does a commercial locksmith cost in the UK?",
        answer:
          "Commercial locksmith work on LockSafe UK starts at £100 for office lockouts; master-key systems and access-control installations are quoted per project after a site visit. All prices are fixed before work begins.",
      },
      {
        question: "What is a restricted-profile key?",
        answer:
          "A restricted-profile key is one that cannot be copied without written authorisation from the registered keyholder. It prevents former staff, contractors, or unauthorised persons from getting unauthorised duplicates cut at a kiosk.",
      },
      {
        question: "Can you handle fire-door compliance work?",
        answer:
          "Yes. Verified commercial locksmiths fit and certify fire-door locks and ironmongery to the relevant British Standards (e.g. BS EN 1634-1 / BS EN 1125). Documentation is supplied for your fire-safety audit trail.",
      },
      {
        question: "Do you cover multi-site facilities contracts?",
        answer:
          "Yes. Multi-site businesses use LockSafe to manage all locksmith work across their portfolio under one account, with consolidated reporting and invoicing for facilities teams.",
      },
      {
        question: "Can you do this out-of-hours to avoid business disruption?",
        answer:
          "Yes. Most commercial work — system upgrades, lock changes, access-control installation — is scheduled for evenings, weekends, or staff-down periods. Out-of-hours surcharges are quoted up front, never sprung on arrival.",
      },
    ],
    comparisonRows: STANDARD_COMPARISON,
    relatedSlugs: ["safe-opening", "lock-change", "landlord-lock-change"],
    priceRangeLow: 100,
    priceRangeHigh: 600,
  },
};

export function getExtendedContent(slug: ServiceSlug): ExtendedServiceContent {
  return EXTENDED_CONTENT[slug];
}
