/**
 * Service-Intent Catalog — single source of truth.
 *
 * Drives:
 *   - /api/meta/catalog-feed (CSV consumed by Meta Commerce Manager)
 *   - /services/[slug] dynamic landing pages
 *   - sitemap entries for /services/[slug]
 *   - Pixel `content_ids` so dynamic ads can match catalog items
 *
 * RULE: catalog item id === pixel content_id. If this drifts, dynamic ads break.
 */

import { getFullUrl } from "@/lib/config";
import {
  EXTENDED_CONTENT,
  type ExtendedServiceContent,
} from "@/lib/services-content-extended";

export const SERVICE_SLUGS = [
  "emergency-locksmith",
  "locked-out",
  "lock-change",
  "broken-key-extraction",
  "upvc-door-lock-repair",
  "burglary-lock-repair",
  "car-key-replacement",
  "safe-opening",
  "landlord-lock-change",
  "commercial-locksmith",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

/** Meta Catalog feed schema (the fields that ship in the CSV). */
export interface CatalogItem {
  id: ServiceSlug;
  title: string;
  description: string;
  availability: "in stock";
  condition: "new";
  price: string; // e.g. "0.00 GBP"
  link: string;
  image_link: string;
  brand: "LockSafe UK";
}

/** Extra fields used by the landing page (not shipped in the CSV). */
export interface ServiceContent {
  /** Short H1-ready hero headline. */
  hero: string;
  /** One-line urgency subhead displayed under the hero. */
  subhead: string;
  /** SEO meta description (also doubles as Catalog description). */
  shortDescription: string;
  /** Long-form copy paragraphs for the landing page body. */
  longDescription: string[];
  /** Bullet-list of what the locksmith does on this job. */
  whatsIncluded: string[];
  /** SEO keywords for the landing page <meta>. */
  keywords: string[];
  /** "From £X" price hint for the landing page (NOT the Meta feed price). */
  priceHint: string;
}

export type ServiceEntry = CatalogItem &
  ServiceContent &
  ExtendedServiceContent;

const BRAND = "LockSafe UK" as const;
const PRICE = "0.00 GBP" as const; // service-intent feed: zero monetary price
const AVAILABILITY = "in stock" as const;
const CONDITION = "new" as const;

function entry(
  slug: ServiceSlug,
  title: string,
  shortDescription: string,
  content: Omit<ServiceContent, "shortDescription">,
): ServiceEntry {
  return {
    id: slug,
    title,
    description: shortDescription,
    availability: AVAILABILITY,
    condition: CONDITION,
    price: PRICE,
    link: getFullUrl(`/services/${slug}`),
    // Use Next.js dynamic OG image route as the catalog image; always
    // on-brand, regenerates with copy changes, no asset management.
    image_link: getFullUrl(`/services/${slug}/opengraph-image`),
    brand: BRAND,
    shortDescription,
    ...content,
    // Merge in conversion-grade extended content (FAQ, value stack, etc.)
    // — page-only fields, NOT shipped in the Meta catalog CSV.
    ...EXTENDED_CONTENT[slug],
  };
}

const ENTRIES: ServiceEntry[] = [
  entry(
    "emergency-locksmith",
    "Emergency Locksmith",
    "Locked out or need urgent help? Post your job and get verified locksmiths competing for your trust before any work starts.",
    {
      hero: "Emergency Locksmith — Fast, Verified, Transparent",
      subhead: "See the price before any work starts. 24/7 across the UK.",
      longDescription: [
        "Emergencies don't wait for office hours. Whether you're locked out, your lock is broken, or your home isn't secure after a break-in, you need a verified locksmith on site fast — without being held hostage on price.",
        "On LockSafe UK, verified locksmiths compete for your job. You see the quote before any work begins, GPS-tracked arrival, and a digital paper trail you can share with your insurer.",
      ],
      whatsIncluded: [
        "Verified, DBS-checked locksmiths only",
        "Quote agreed before work starts — no surprise fees",
        "GPS-tracked arrival and timestamped photos",
        "Available 24/7, 365 days a year",
      ],
      keywords: [
        "emergency locksmith",
        "24 hour locksmith",
        "urgent locksmith",
        "locksmith near me",
      ],
      priceHint: "From £60",
    },
  ),
  entry(
    "locked-out",
    "Locked Out",
    "Locked out of your home? Get a fast response from verified locksmiths with clear pricing — agreed before any work starts.",
    {
      hero: "Locked Out? Get Back In — Without the Stitch-Up.",
      subhead:
        "Verified locksmiths quote upfront. Non-destructive entry first.",
      longDescription: [
        "Locked out is stressful enough without a £600 invoice on top. Post your job and verified, local locksmiths quote you upfront — non-destructive entry first, drilling only as a last resort.",
        "You see who's coming, when they'll arrive, and the agreed price — before any work begins.",
      ],
      whatsIncluded: [
        "Non-destructive entry attempted first",
        "Upfront, agreed price before work starts",
        "Live GPS tracking of your locksmith",
        "Digital invoice and photo report",
      ],
      keywords: [
        "locked out",
        "locked out of house",
        "lockout service",
        "house lockout locksmith",
      ],
      priceHint: "From £60",
    },
  ),
  entry(
    "lock-change",
    "Lock Change",
    "New tenant, lost keys, or upgrade time? Get a BS3621 lock change from verified, insurance-approved locksmiths.",
    {
      hero: "Lock Change — Insurance-Compliant, Fitted Today.",
      subhead:
        "British Standard BS3621 locks. Verified locksmiths. Fixed quote.",
      longDescription: [
        "Whether you've moved house, lost your keys, or want better security, replacing your locks should be simple. We connect you with verified locksmiths who fit insurance-approved British Standard BS3621 locks at a price agreed up front.",
        "Same-day fitting available across most of the UK.",
      ],
      whatsIncluded: [
        "BS3621 insurance-compliant locks",
        "Cylinder, mortice, and multi-point options",
        "Old locks removed and disposed of",
        "Fitted and tested same day",
      ],
      keywords: [
        "lock change",
        "change locks",
        "new locks fitted",
        "BS3621 lock fitting",
      ],
      priceHint: "From £80",
    },
  ),
  entry(
    "broken-key-extraction",
    "Broken Key Extraction",
    "Snapped your key in the lock? Verified locksmiths extract broken keys without damaging your cylinder.",
    {
      hero: "Broken Key in the Lock? We Get It Out Without Damage.",
      subhead:
        "Specialist extraction. Cylinder saved where possible. Fixed price.",
      longDescription: [
        "A snapped key doesn't have to mean a new lock. Our verified locksmiths use specialist extraction tools to remove broken keys cleanly — saving your existing cylinder where the lock is undamaged.",
        "If the cylinder is damaged, we'll quote a like-for-like replacement before any work begins.",
      ],
      whatsIncluded: [
        "Specialist key-extraction tools",
        "Cylinder saved wherever possible",
        "Replacement key cut on site if needed",
        "Fixed quote before work starts",
      ],
      keywords: [
        "broken key extraction",
        "key snapped in lock",
        "remove broken key",
        "key stuck in lock",
      ],
      priceHint: "From £70",
    },
  ),
  entry(
    "upvc-door-lock-repair",
    "UPVC Door Lock Repair",
    "UPVC door not locking properly? Multi-point lock failures repaired by verified specialists with upfront pricing.",
    {
      hero: "UPVC Door Won't Lock? Fix the Mechanism, Not the Door.",
      subhead:
        "Multi-point lock specialists. Repair before replace. Fixed quote.",
      longDescription: [
        "A failing UPVC door is almost always the multi-point gearbox or cylinder — not the door itself. Our verified locksmiths diagnose the exact failure and repair it, often saving you the cost of a full door replacement.",
        "Most UPVC repairs are completed same day, with a fixed quote agreed before any work begins.",
      ],
      whatsIncluded: [
        "Multi-point lock mechanism diagnosis",
        "Gearbox, cylinder, and handle repairs",
        "Anti-snap upgrade options available",
        "Same-day repair where parts are stocked",
      ],
      keywords: [
        "upvc door lock repair",
        "multi-point lock repair",
        "upvc door not locking",
        "patio door lock repair",
      ],
      priceHint: "From £80",
    },
  ),
  entry(
    "burglary-lock-repair",
    "Burglary Lock Repair",
    "After a break-in, get your home secure tonight. Verified locksmiths, insurance-friendly paper trail.",
    {
      hero: "Burglary Repair — Secure Tonight, Insurance-Ready Paperwork.",
      subhead:
        "Boarding, lock replacement, and a digital report for your insurer.",
      longDescription: [
        "After a break-in, the priority is getting your home secure tonight. Our verified locksmiths attend rapidly, replace damaged locks with insurance-approved BS3621 hardware, and provide the timestamped photos and digital report your insurer will ask for.",
        "We also coordinate emergency boarding for damaged doors and windows where needed.",
      ],
      whatsIncluded: [
        "Rapid emergency response, 24/7",
        "BS3621 insurance-compliant lock replacement",
        "Timestamped photos and digital report for insurer",
        "Emergency boarding coordination",
      ],
      keywords: [
        "burglary lock repair",
        "after break in locksmith",
        "post burglary security",
        "emergency boarding",
      ],
      priceHint: "From £90",
    },
  ),
  entry(
    "car-key-replacement",
    "Car Key Replacement",
    "Lost your car keys? Auto locksmiths cut and program replacement keys on site — most makes and models.",
    {
      hero: "Lost Car Keys? Replaced On Site — Most Makes & Models.",
      subhead:
        "Mobile auto locksmiths. Cut, programmed, and tested at your location.",
      longDescription: [
        "Don't pay dealership prices or wait days for a key. Our verified mobile auto locksmiths come to you, cut and program a new transponder key on site, and test it before you pay.",
        "Covers most petrol, diesel, and hybrid vehicles. Tell us your make, model, and year and we'll match you with a specialist.",
      ],
      whatsIncluded: [
        "Mobile service — we come to you",
        "Transponder programming on most makes",
        "Spare keys and remote fobs",
        "Tested before you pay",
      ],
      keywords: [
        "car key replacement",
        "auto locksmith",
        "lost car keys",
        "transponder key programming",
      ],
      priceHint: "From £120",
    },
  ),
  entry(
    "safe-opening",
    "Safe Opening",
    "Locked out of a safe? Verified safe specialists open most domestic and commercial safes non-destructively.",
    {
      hero: "Safe Locked? Opened Non-Destructively, Where Possible.",
      subhead:
        "Specialist safe technicians. Manipulation first, drilling last.",
      longDescription: [
        "Whether it's a forgotten combination, dead battery, or jammed mechanism, our verified safe specialists open most domestic and commercial safes — manipulation and bypass methods first, drilling only as a last resort.",
        "We also reset combinations and replace lost keys for popular safe brands.",
      ],
      whatsIncluded: [
        "Manipulation and bypass before drilling",
        "Combination resets and key replacement",
        "Domestic and commercial safes",
        "Quote agreed before any work starts",
      ],
      keywords: [
        "safe opening",
        "safe locked out",
        "safe combination reset",
        "safe locksmith",
      ],
      priceHint: "From £150",
    },
  ),
  entry(
    "landlord-lock-change",
    "Landlord Lock Change",
    "Tenant changeover? Section 21? Get verified, BS3621 lock changes with full paperwork for your portfolio.",
    {
      hero: "Landlord Lock Changes — Compliant, Documented, Same Day.",
      subhead: "BS3621 locks. Multi-property pricing. Full digital records.",
      longDescription: [
        "Tenant moving out? Lost keys mid-tenancy? Our verified locksmiths handle landlord lock changes with the documentation you need — BS3621 insurance-compliant locks, photographic evidence, and digital invoices ready for your accountant or letting agent.",
        "Discounts available for portfolios of 3 or more properties.",
      ],
      whatsIncluded: [
        "BS3621 insurance-compliant locks",
        "Tenant changeover and end-of-tenancy fitting",
        "Photographic evidence and digital invoice",
        "Portfolio pricing for 3+ properties",
      ],
      keywords: [
        "landlord lock change",
        "tenant changeover locks",
        "rental property locksmith",
        "letting agent locksmith",
      ],
      priceHint: "From £75",
    },
  ),
  entry(
    "commercial-locksmith",
    "Commercial Locksmith",
    "Office lockouts, master key systems, fire-door compliance. Verified commercial locksmiths across the UK.",
    {
      hero: "Commercial Locksmith — Master Keys, Access Control, Compliance.",
      subhead:
        "Verified commercial specialists. Restricted profiles. Fire-door compliant.",
      longDescription: [
        "From an office lockout to a multi-site master-key system, our verified commercial locksmiths cover the full range of business security needs — including fire-door compliance, restricted-profile keys that can't be copied without authorisation, and access-control installation.",
        "All work is documented and invoiced for your facilities team.",
      ],
      whatsIncluded: [
        "Master key and restricted-profile systems",
        "Access control installation",
        "Fire-door compliance work",
        "Documented invoices for facilities teams",
      ],
      keywords: [
        "commercial locksmith",
        "office locksmith",
        "master key system",
        "business locksmith",
      ],
      priceHint: "From £100",
    },
  ),
];

/** Frozen array — never mutated at runtime. */
export const SERVICE_CATALOG: readonly ServiceEntry[] = Object.freeze(ENTRIES);

export function getAllServiceSlugs(): readonly ServiceSlug[] {
  return SERVICE_SLUGS;
}

export function getServiceBySlug(slug: string): ServiceEntry | undefined {
  return SERVICE_CATALOG.find((s) => s.id === slug);
}

export function isServiceSlug(value: unknown): value is ServiceSlug {
  return (
    typeof value === "string" &&
    (SERVICE_SLUGS as readonly string[]).includes(value)
  );
}

/** Strip the landing-page-only fields, leaving only the Meta feed schema. */
export function toCatalogItem(entry: ServiceEntry): CatalogItem {
  const {
    id,
    title,
    description,
    availability,
    condition,
    price,
    link,
    image_link,
    brand,
  } = entry;
  return {
    id,
    title,
    description,
    availability,
    condition,
    price,
    link,
    image_link,
    brand,
  };
}

/**
 * Bridge legacy job/intake `problemType` values to a catalog id so Pixel +
 * CAPI events emit a `content_id` matching what Meta sees in the feed.
 *
 * Returns `undefined` if no mapping is found — callers should then omit
 * `content_ids` rather than send a guess.
 */
export function mapJobProblemTypeToCatalogId(
  problemType: string | null | undefined,
): ServiceSlug | undefined {
  if (!problemType) return undefined;
  const key = problemType.toLowerCase().replace(/[\s_]+/g, "-");

  // Direct slug match (already canonical).
  if (isServiceSlug(key)) return key;

  // Known legacy aliases — keep this list close to the values seen in the
  // job intake form, Bland AI pathway, and Prisma `Job.problemType`.
  const aliases: Record<string, ServiceSlug> = {
    // legacy / intake values
    lockout: "locked-out",
    "locked-out-house": "locked-out",
    "locked-out-home": "locked-out",
    "locked-out-flat": "locked-out",
    "locked-out-office": "commercial-locksmith",
    broken: "broken-key-extraction",
    "broken-lock": "lock-change",
    "broken-key": "broken-key-extraction",
    "key-stuck": "broken-key-extraction",
    "key-snapped": "broken-key-extraction",
    "lost-keys": "lock-change",
    "lost-key": "lock-change",
    burglary: "burglary-lock-repair",
    "break-in": "burglary-lock-repair",
    upvc: "upvc-door-lock-repair",
    "upvc-door": "upvc-door-lock-repair",
    "multi-point": "upvc-door-lock-repair",
    "patio-door": "upvc-door-lock-repair",
    car: "car-key-replacement",
    "car-key": "car-key-replacement",
    auto: "car-key-replacement",
    vehicle: "car-key-replacement",
    safe: "safe-opening",
    landlord: "landlord-lock-change",
    "tenant-changeover": "landlord-lock-change",
    commercial: "commercial-locksmith",
    office: "commercial-locksmith",
    business: "commercial-locksmith",
    emergency: "emergency-locksmith",
    other: "emergency-locksmith",
  };

  return aliases[key];
}
