/**
 * Static IntentLanding records — content for `/intent/[slug]` programmatic
 * pages. Mirrors the Mademoiselle Atelier `IntentLanding` DB rows structure
 * but ships as a typed array (no DB, build-time SSG).
 *
 * Add new landings here; each is rendered by the route at /intent/[slug]
 * and re-localised at /intent/[slug]/in/[city] for the GEO surface.
 *
 * Editor checklist for adding a landing:
 *   1. Pick a `pillarKeyword` from `intents-catalog.ts:PILLAR_KEYWORDS`.
 *   2. Set ≥3 `intentTags` for similarity-based linking.
 *   3. Write ≥250 words `seoCopy` (HTML) to qualify for Article schema.
 *   4. Add ≥4 `faqs` for FAQPage schema.
 *   5. Optionally add `blocks.segments` (curated sub-experiences).
 */

import type { IntentLanding } from "@/lib/intent-landing";

export const INTENT_LANDINGS: IntentLanding[] = [
  // -------------------------------------------------------------------------
  {
    slug: "locked-out-at-night",
    title: "Locked Out at Night",
    h1: "Locked Out at Night — Verified Locksmith on Site in 15–30 Minutes",
    metaTitle: "Locked Out at Night? Verified UK Locksmith, Price Agreed First",
    metaDescription:
      "Locked out after dark? LockSafe sends a DBS-verified locksmith with the price agreed before any work starts. 24/7 across the UK, GPS-tracked arrival.",
    intro:
      "It's the middle of the night, the door's shut behind you, and every Google result is a £49 ad that ends in a £300 bill. We built LockSafe so that never happens to you again.",
    seoCopy: `<h2>Why night call-outs become the most expensive scams</h2>
<p>Search "emergency locksmith near me" at 2 a.m. and the top results are paid ads from <strong>national lead-generators</strong>, not local locksmiths. They quote £49 on the phone, sub-contract your job to whoever answers first, and the price you pay on the doorstep has nothing to do with what you were quoted. The Trading Standards "locksmith scams" file is full of these stories — and they get worse at night because you're tired, stressed, and not in a position to negotiate.</p>
<p>LockSafe is built differently. You post the job in 90 seconds, <strong>DBS-verified locksmiths within range bid the real price</strong>, and you pick the one you want before anyone leaves the depot. The price you accept is the price you pay. GPS-tracked arrival, timestamped photos, digital signature — your insurer (or a court) can see exactly what happened.</p>
<h2>What to do <em>right now</em> if you're locked out</h2>
<ol>
  <li><strong>Don't break a window.</strong> A pane of glass costs more than the call-out, and your insurance may not cover damage you cause.</li>
  <li><strong>Check the obvious.</strong> Back door, ground-floor window with a latch, neighbour with a spare. 30 seconds well spent.</li>
  <li><strong>Don't call the first ad you see.</strong> National brokers use the same fake "local locksmith" branding region after region.</li>
  <li><strong>Post the job on LockSafe.</strong> Set your address, what's happened, and accept the bid you like. Average response time is 15–30 minutes nationwide.</li>
</ol>
<h2>What a locked-out call-out should actually cost</h2>
<p>For a standard residential lockout, expect <strong>£70–£140 in the day, £100–£180 at night</strong>, including a non-destructive entry on a Yale or euro-cylinder lock. If your locksmith says they "need to drill the cylinder" before they've even tried picking it, that's a flag — most house locks can be opened non-destructively by a competent professional. Anyone quoting £400+ "because it's after midnight" is taking advantage.</p>
<h2>Why LockSafe customers don't get scammed</h2>
<p>Every locksmith on the platform is <strong>DBS-checked, ID-verified, and insured</strong>. Every bid is logged. Every arrival is GPS-tracked. Every job ends with a digital paper trail you can share — and if something goes wrong, our dispute team has the data to back you up. That's the bit no other "locksmith near me" service has.</p>`,
    heroImageUrl: undefined,
    emotionalHook: "Locked out at midnight? Don't pay the panic premium.",
    heroSubcopy:
      "See the real price before anyone leaves the depot. DBS-verified locksmiths, GPS-tracked, paper-trail every job.",
    emotionalHookB: "It's late, the door's shut, and every ad is a trap.",
    heroSubcopyB:
      "LockSafe shows you who's nearby, what they charge, and tracks them to your door. No surprises on the bill.",
    pillarKeyword: "locked-out",
    intentTags: ["locked-out", "night", "urgent", "emergency"],
    serviceFilter: {
      serviceSlugs: ["emergency-locksmith", "locked-out"],
      keywords: ["emergency", "night", "locked out"],
    },
    faqs: [
      {
        question: "How much does a night-time locksmith call-out cost in the UK?",
        answer:
          "Expect £100–£180 for a standard residential lockout at night, including non-destructive entry. Anything north of £250 for a simple Yale or euro-cylinder is well above market rate and almost always a sign of a national broker, not a local locksmith.",
      },
      {
        question: "How fast can a locksmith get to me at night?",
        answer:
          "Through LockSafe, average response time is 15–30 minutes across most UK postcodes. Bids appear from locksmiths actively on call within minutes of posting your job.",
      },
      {
        question: "Will my insurance cover the call-out?",
        answer:
          "Many home insurance policies include emergency locksmith cover up to a set limit, but they require an itemised invoice and proof the work was necessary. LockSafe automatically generates an insurer-ready PDF for every completed job.",
      },
      {
        question: "Do I need to break a window if I'm locked out?",
        answer:
          "Almost never. A competent locksmith can open the majority of UK residential locks non-destructively. Breaking a window means a glazier bill on top of the locksmith bill, and your insurance may not cover self-inflicted damage.",
      },
      {
        question: "Why are night-time locksmith prices double the daytime rate?",
        answer:
          "Genuine after-hours work attracts a modest premium (typically 30–50% over day rate). A 'doubled' price isn't standard — it's a sign the bidder is testing how desperate you are.",
      },
    ],
    blocks: {
      segments: [
        {
          id: "no-spare-key",
          label: "No spare key anywhere",
          emotionalAngle:
            "No partner with a copy, no neighbour with the back-door spare. You need a locksmith who can get you in without damage — and won't change the lock 'just in case' to push the price up.",
          serviceFilter: { serviceSlugs: ["locked-out", "emergency-locksmith"] },
          ctaLabel: "Get a verified locksmith",
        },
        {
          id: "key-snapped",
          label: "Key snapped in the lock",
          emotionalAngle:
            "Half the key is in your hand, half is in the cylinder. This is fixable in 20 minutes by someone with the right extraction tools — and rarely needs a whole new lock.",
          serviceFilter: { serviceSlugs: ["broken-key-extraction", "lock-change"] },
          ctaLabel: "See locksmiths who do extractions",
        },
        {
          id: "front-door-wont-budge",
          label: "Lock turns but door won't open",
          emotionalAngle:
            "Usually a worn euro-cylinder gearbox or a sagging UPVC door. Don't let anyone tell you the whole door has to be replaced — a £90 cylinder swap fixes most of these.",
          serviceFilter: {
            serviceSlugs: ["upvc-door-lock-repair", "lock-change", "emergency-locksmith"],
          },
          ctaLabel: "Fix the lock, not the door",
        },
      ],
      aiSearchQA: [
        {
          question: "Is it cheaper to wait until morning if I'm locked out at night?",
          answer:
            "If it's safe to wait (a friend's sofa, a 24-hour café), yes — daytime call-outs are typically 30–50% cheaper. If you're in cold, with kids, or your phone's about to die, the night premium is worth paying for a verified locksmith with a transparent price.",
        },
        {
          question: "What's the difference between a locksmith and a 'locksmith near me' ad?",
          answer:
            "Most paid 'locksmith near me' ads belong to national call-centre brokers, not local locksmiths. They sub-contract your job and skim a fee, which is why the doorstep price often doesn't match the phone quote. LockSafe only lists verified individual locksmiths — no brokers.",
        },
        {
          question: "Can a locksmith open my door without breaking it?",
          answer:
            "Yes — non-destructive entry is the default for any competent locksmith on a standard UK residential lock. Drilling is a last resort. If the first thing a bidder says is 'we'll have to drill', ask why, and consider another bid.",
        },
      ],
      trustConfidence: [
        {
          topic: "verification",
          title: "Every locksmith DBS-checked",
          body: "We verify identity, criminal record check, and trade insurance before any locksmith can bid on your job. No call-centre brokers, no sub-contracting chains.",
        },
        {
          topic: "pricing",
          title: "Price agreed before any work starts",
          body: "The bid you accept is the price you pay. If a job genuinely changes (a hidden second lock), the locksmith has to send you a new price for approval before continuing.",
        },
        {
          topic: "paper-trail",
          title: "GPS, photos and signature on every job",
          body: "Arrival is GPS-tracked. Before-and-after photos are timestamped to your job record. You sign off digitally — and so does the locksmith.",
        },
        {
          topic: "response-time",
          title: "15–30 minute response across the UK",
          body: "Active locksmiths are matched by postcode and live availability. Most urban postcodes see the first bid within 3 minutes.",
        },
      ],
      socialProofClusters: [
        {
          label: "most-booked",
          heading: "Most-booked emergency services tonight",
          serviceFilter: { serviceSlugs: ["emergency-locksmith", "locked-out"] },
          dynamicSource: "top-booked-30d",
        },
      ],
      relatedClusters: [
        {
          heading: "Other late-night scenarios",
          slugs: ["key-snapped-in-lock", "locked-out-of-house-no-keys"],
        },
        {
          heading: "When the locks need replacing",
          slugs: ["burgled-need-locks-changed", "lost-house-keys"],
        },
      ],
    },
    relatedSlugs: ["key-snapped-in-lock", "locked-out-of-house-no-keys"],
    isActive: true,
    position: 1,
    publishedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },

  // -------------------------------------------------------------------------
  {
    slug: "burgled-need-locks-changed",
    title: "Locks Changed After Burglary",
    h1: "Burgled? Locks Changed Tonight by a Verified Locksmith",
    metaTitle: "Burgled — Need Locks Changed Now | LockSafe UK",
    metaDescription:
      "Burglary lock change with verified, DBS-checked locksmiths. Insurance-ready PDF, GPS-tracked arrival, price agreed before any work starts.",
    intro:
      "After a break-in, the priority is sleeping safely tonight — not negotiating a price with someone who knows you're rattled. LockSafe handles both.",
    seoCopy: `<h2>What to do in the first hour after a burglary</h2>
<ol>
  <li><strong>Call 101 (or 999 if intruders may still be present)</strong> and get a crime reference number. Your insurer will need it.</li>
  <li><strong>Don't touch the entry point</strong> until police have decided whether to dust for prints.</li>
  <li><strong>Photograph every damaged door, frame and window.</strong> Insurance loves timestamped evidence.</li>
  <li><strong>Post a job on LockSafe</strong>. Specify "burglary lock repair / replacement" and your crime reference — bids come back with insurance-grade itemisation.</li>
</ol>
<h2>What "changing the locks" actually means</h2>
<p>For most UK doors, you don't need to replace the entire lock — just the <strong>euro-cylinder</strong> (the brass bit the key turns in). A British Standard anti-snap cylinder costs £35–£80 and takes 15 minutes to fit. Be wary of anyone insisting the whole mortice case or multi-point gearbox needs replacing without showing you why.</p>
<h2>Insurance: get the paperwork right</h2>
<p>Most home contents policies cover post-burglary lock changes up to a set amount, but they need an <strong>itemised invoice, the crime reference number, and proof the new locks meet British Standard BS 3621</strong>. Every LockSafe job generates a PDF that contains all three automatically.</p>
<h2>Securing the rest of the door</h2>
<p>If the burglar got in by snapping the cylinder, replacing it with a like-for-like is a temporary fix at best. Ask for an <strong>anti-snap (TS007 3-star)</strong> cylinder and check the door hinges and frame for splitting. A good locksmith will tell you whether the door itself is still secure or needs a joiner.</p>`,
    emotionalHook: "Burgled tonight? We get you safe by morning.",
    heroSubcopy:
      "DBS-verified locksmiths, anti-snap cylinders, insurance-ready paperwork — price agreed before any work begins.",
    pillarKeyword: "burglary-repair",
    intentTags: ["burglary", "lock-change", "security", "urgent", "insurance"],
    serviceFilter: {
      serviceSlugs: ["burglary-lock-repair", "lock-change", "emergency-locksmith"],
      keywords: ["burglary", "security", "anti-snap"],
    },
    faqs: [
      {
        question: "How quickly can locks be changed after a burglary?",
        answer:
          "Most LockSafe locksmiths can be on site within 30–60 minutes of you accepting their bid, and a standard cylinder change is a 15–20 minute job.",
      },
      {
        question: "Will my home insurance pay for the locks?",
        answer:
          "Almost all UK home contents policies cover post-burglary lock changes up to a stated limit (£250–£500 is common), provided you supply a crime reference number and an itemised invoice. LockSafe generates the invoice for you automatically.",
      },
      {
        question: "Should I replace all the locks or just the broken one?",
        answer:
          "If a key has been stolen, replace every cylinder that key opens. If the burglar broke a single cylinder, that cylinder is the only one that must be replaced — but consider upgrading every external door to anti-snap (TS007 3-star) at the same time.",
      },
      {
        question: "What is an anti-snap cylinder and do I need one?",
        answer:
          "Anti-snap (TS007 3-star or Sold Secure Diamond) cylinders are designed to break in a controlled way so an attacker can't pull them out with mole grips. Lock snapping is the most common UPVC-door burglary method in the UK, so yes — fit them on every external door.",
      },
    ],
    blocks: {
      segments: [
        {
          id: "front-door-cylinder",
          label: "Front door cylinder snapped",
          emotionalAngle:
            "Classic UPVC-door attack — a £45 cylinder swap restores security. Make sure the replacement is TS007 3-star or Sold Secure Diamond.",
          serviceFilter: { serviceSlugs: ["burglary-lock-repair", "lock-change"] },
        },
        {
          id: "multipoint-broken",
          label: "Multi-point door lock damaged",
          emotionalAngle:
            "If the door has multiple hooks/rollers, the gearbox might need replacing — a £120–£200 part on top of the call-out. A good locksmith will show you the damaged gearbox before quoting.",
          serviceFilter: { serviceSlugs: ["upvc-door-lock-repair", "lock-change"] },
        },
        {
          id: "stolen-keys",
          label: "Keys were taken",
          emotionalAngle:
            "Every door the stolen key opens needs a new cylinder. Don't let anyone tell you it's the entire lock case — for cylinders, it's the cylinder.",
          serviceFilter: { serviceSlugs: ["lock-change"] },
        },
      ],
      aiSearchQA: [
        {
          question: "Is it safe to stay in the house tonight after a burglary?",
          answer:
            "If the entry point is secured (new cylinder fitted, door boarded if frame is split), yes. If you can't get a locksmith out tonight, ask a neighbour to stay or move to a hotel — your insurer will usually cover one night of emergency accommodation.",
        },
        {
          question: "How do I prove to my insurer the locks were British Standard?",
          answer:
            "Ask the locksmith to attach photos of the new cylinder packaging (showing the kitemark and TS007 star rating) to the LockSafe job record. The PDF generated at completion bundles this with the invoice automatically.",
        },
      ],
      trustConfidence: [
        {
          topic: "insurance",
          title: "Insurance-ready paperwork",
          body: "Every completed job exports a PDF with itemised parts and labour, photos, GPS arrival timestamp and the locksmith's digital signature — exactly what loss adjusters ask for.",
        },
        {
          topic: "verification",
          title: "DBS-checked locksmiths only",
          body: "After a break-in is the worst possible moment to be letting an unverified stranger into the house. We verify every locksmith before they can bid.",
        },
        {
          topic: "pricing",
          title: "Price up-front, no doorstep upsells",
          body: "The cylinder, gearbox or full lock case is priced in the bid before anyone leaves the depot. If something genuinely changes on site, the locksmith has to ask before continuing.",
        },
      ],
      socialProofClusters: [],
      relatedClusters: [
        {
          heading: "Related security scenarios",
          slugs: ["upvc-door-wont-lock", "lost-house-keys"],
        },
      ],
    },
    relatedSlugs: ["upvc-door-wont-lock", "lost-house-keys"],
    isActive: true,
    position: 2,
    publishedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },

  // -------------------------------------------------------------------------
  {
    slug: "key-snapped-in-lock",
    title: "Key Snapped in the Lock",
    h1: "Key Snapped in the Lock — Extraction, Not Replacement",
    metaTitle: "Key Snapped in Lock — Extracted in 20 Mins | LockSafe UK",
    metaDescription:
      "Snapped key extraction by verified UK locksmiths. Most jobs done non-destructively in 20 minutes. Price agreed before work starts.",
    intro:
      "Half the key in your hand, half in the cylinder. The good news: a competent locksmith has it out in 20 minutes, and you almost never need a new lock.",
    seoCopy: `<h2>Why keys snap (and why it's rarely your fault)</h2>
<p>Snapped keys usually mean a <strong>worn cylinder, a misaligned door, or a cheap blank key</strong>. Forcing the turn was the final straw, but the underlying problem was already there. Once the broken half is extracted, a good locksmith will tell you which of those three caused it — and what to do about it.</p>
<h2>What the extraction actually looks like</h2>
<p>Specialist extractors are slim spring-steel hooks that grip the bittings of the broken half and slide it back out. A skilled locksmith will have the key out in <strong>5–20 minutes for most UK domestic cylinders</strong>. If a bidder's first move is to drill the cylinder, ask why — drilling is for cases where extraction has genuinely failed, not the default.</p>
<h2>Do I need a new lock after a snap?</h2>
<p>Usually no. Once the broken half is out, the cylinder is fully functional — you just need a new key cut to the existing pin code. If the cylinder is genuinely worn (which is what caused the snap), <strong>budget £45–£80 for a replacement euro-cylinder</strong> and ask for an anti-snap one while you're at it.</p>`,
    emotionalHook: "Snapped key in the lock? We extract it. We don't drill it.",
    heroSubcopy:
      "DBS-verified locksmiths with extraction tools — most jobs done non-destructively in under 20 minutes.",
    pillarKeyword: "locked-out",
    intentTags: ["broken-key", "locked-out", "urgent", "extraction"],
    serviceFilter: {
      serviceSlugs: ["broken-key-extraction", "lock-change", "emergency-locksmith"],
    },
    faqs: [
      {
        question: "How long does it take to extract a snapped key?",
        answer:
          "Typically 5–20 minutes for a standard UK euro-cylinder or nightlatch. Mortice locks can take a little longer because of the deeper keyway.",
      },
      {
        question: "Will I need a new lock?",
        answer:
          "Usually not — once the broken half is removed, the lock still works. You will need a new key cut. If the cylinder is visibly worn, it's worth replacing while the locksmith is on site.",
      },
      {
        question: "Can I extract a snapped key myself?",
        answer:
          "If a few millimetres of the broken half are sticking out, fine-nose pliers sometimes work. If the break is flush or recessed, you need specialist extractors — DIY attempts usually push the broken half deeper and turn a 20-minute job into a drill-out.",
      },
      {
        question: "Why did my key snap in the first place?",
        answer:
          "Most commonly: a worn cylinder where the pins no longer align cleanly, a misaligned door where the bolt drags against the strike plate, or a cheap blank cut by a kiosk. The locksmith can usually tell you which one in 30 seconds of inspection.",
      },
    ],
    blocks: {
      segments: [],
      aiSearchQA: [
        {
          question: "Should I use WD-40 if my key is stuck?",
          answer:
            "No — WD-40 attracts dust into the cylinder and makes things worse over time. Graphite powder or a dedicated lock lubricant (Tri-Flow, Lock-Aid) is what locksmiths actually use.",
        },
      ],
      trustConfidence: [
        {
          topic: "verification",
          title: "Locksmiths with extraction tools",
          body: "Every bidder on LockSafe carries the kit to extract — not just drill. Drilling is the last resort, not the opening move.",
        },
        {
          topic: "pricing",
          title: "Extraction quoted up-front",
          body: "Bids itemise the extraction call-out separately from any lock replacement, so you only pay for what's needed.",
        },
      ],
      socialProofClusters: [],
      relatedClusters: [
        {
          heading: "Related lockout scenarios",
          slugs: ["locked-out-at-night", "locked-out-of-house-no-keys"],
        },
      ],
    },
    relatedSlugs: ["locked-out-at-night", "upvc-door-wont-lock"],
    isActive: true,
    position: 3,
    publishedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },

  // -------------------------------------------------------------------------
  {
    slug: "moving-in-change-locks",
    title: "Just Moved In — Changing the Locks",
    h1: "Just Moved In? Change the Locks Before You Unpack",
    metaTitle: "New Home Lock Change | Verified Locksmiths | LockSafe UK",
    metaDescription:
      "Just moved in? You don't know who else has keys. Verified locksmiths fit anti-snap cylinders on every external door — price agreed before any work starts.",
    intro:
      "You don't know how many spare keys the previous owners cut, gave to cleaners, or lost. A £180 lock change is the cheapest peace of mind you'll buy this year.",
    seoCopy: `<h2>Why every solicitor recommends it</h2>
<p>When you complete on a UK property, you have <strong>no record</strong> of how many keys exist. Cleaners, gardeners, contractors, ex-partners, lodgers — any of them could still hold one. Conveyancing solicitors routinely flag this in their completion advice, and every home insurance policy makes you responsible for "reasonable security".</p>
<h2>What "changing the locks" should cost</h2>
<p>For a typical UK home with two external doors (front and back), expect <strong>£140–£220</strong> for two anti-snap (TS007 3-star) euro-cylinders fitted, plus a key set for each new lock. Add £50–£90 if you also want a window-lock check. Anyone quoting much higher should be itemising what the extra cost is for.</p>
<h2>Anti-snap as standard</h2>
<p>If your new house has UPVC doors with euro-cylinders (most do), <strong>fit anti-snap</strong>. Lock snapping is the most common forced-entry method in the UK and a £45 upgrade closes off the vulnerability completely.</p>`,
    emotionalHook: "Just moved in? You don't know who else has keys.",
    heroSubcopy:
      "Anti-snap cylinders fitted on every external door, price agreed up-front, paperwork your insurer accepts.",
    pillarKeyword: "lock-change",
    intentTags: ["moving-in", "new-home", "lock-change", "security", "planned"],
    serviceFilter: {
      serviceSlugs: ["lock-change"],
    },
    faqs: [
      {
        question: "How soon after moving in should I change the locks?",
        answer:
          "Solicitors typically recommend doing it within the first week. There's no legal requirement, but until you do, anyone who held a key during the previous owner's tenure still has access.",
      },
      {
        question: "Do I have to change every lock?",
        answer:
          "Change every cylinder a previously-issued key could open. For most homes that's the front door, back door, side door and garage. Internal locks can usually wait or be re-keyed cheaply.",
      },
      {
        question: "Will my home insurance require anti-snap locks?",
        answer:
          "Most policies require BS 3621 or TS007 1-star+ on external doors. Anti-snap 3-star is the gold standard and almost never excluded.",
      },
      {
        question: "Can I just re-key the existing locks instead of replacing them?",
        answer:
          "On some lock types yes, but for the modern UK euro-cylinder it's nearly always cheaper to swap the whole cylinder than to re-pin it. A locksmith will tell you which case applies to your doors.",
      },
    ],
    blocks: {
      segments: [],
      aiSearchQA: [],
      trustConfidence: [
        {
          topic: "verification",
          title: "DBS-checked locksmiths",
          body: "A new home is the worst possible time to let an unvetted stranger see how your locks work.",
        },
        {
          topic: "pricing",
          title: "Whole-house quote up-front",
          body: "Tell us how many external doors you have — bids come back with the full job priced, not a tease price for door one and a surprise for door two.",
        },
      ],
      socialProofClusters: [],
      relatedClusters: [
        { heading: "Related scenarios", slugs: ["lost-house-keys", "landlord-changing-tenant-locks"] },
      ],
    },
    relatedSlugs: ["lost-house-keys", "landlord-changing-tenant-locks"],
    isActive: true,
    position: 4,
    publishedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },

  // -------------------------------------------------------------------------
  {
    slug: "locked-out-of-car",
    title: "Locked Out of My Car",
    h1: "Locked Out of Your Car — Auto Locksmith Without Damage",
    metaTitle: "Locked Out of Car — Auto Locksmith UK | LockSafe",
    metaDescription:
      "Auto locksmiths who open cars without breaking windows. Most makes including transponder keys. Price agreed before work begins.",
    intro:
      "Keys on the seat, kids in the back, dog in the boot. An auto locksmith will have you in within 30 minutes — no broken window, no insurance claim.",
    seoCopy: `<h2>Why you don't need to call the AA</h2>
<p>Recovery services will open most cars, but they're optimised for breakdowns — they may take 2+ hours to reach a lockout because it's not life-threatening. A dedicated <strong>auto locksmith</strong> on LockSafe will typically be on site in 30–60 minutes and carries the tools for non-destructive entry on virtually all UK makes including modern transponder-key systems.</p>
<h2>What it should cost</h2>
<p>£70–£140 for a standard car opening, £120–£200 at night. If your key is lost (not just locked inside), add the price of a replacement transponder key — that's a separate, longer job we cover under "lost car keys".</p>`,
    emotionalHook: "Keys locked inside? No broken windows. No insurance claim.",
    heroSubcopy:
      "Auto locksmiths arrive in 30–60 minutes with non-destructive entry tools — even for keyless and transponder cars.",
    pillarKeyword: "auto-locksmith",
    intentTags: ["car", "auto", "locked-out", "urgent"],
    serviceFilter: { serviceSlugs: ["car-key-replacement", "emergency-locksmith"] },
    faqs: [
      {
        question: "Can an auto locksmith open my car without damaging it?",
        answer:
          "Yes — virtually all modern cars can be opened non-destructively with the right tools (long-reach, slim-jim, air wedge). A competent auto locksmith won't even consider breaking glass on a lockout.",
      },
      {
        question: "What about keyless and push-to-start cars?",
        answer:
          "Keyless cars are still mechanically lockable for security, so the same non-destructive entry techniques apply. If the fob battery is flat, the locksmith can also boost or replace it on site.",
      },
      {
        question: "Should I call my insurance instead?",
        answer:
          "Most comprehensive policies don't cover lockouts unless you have specific 'key cover'. Even where covered, the response time is usually slower than a local auto locksmith.",
      },
    ],
    blocks: {
      segments: [],
      aiSearchQA: [],
      trustConfidence: [
        {
          topic: "verification",
          title: "Auto locksmiths only",
          body: "Auto work needs different tools than house locksmithing. Filter your job to 'car' and only verified auto locksmiths can bid.",
        },
      ],
      socialProofClusters: [],
      relatedClusters: [
        { heading: "Related car scenarios", slugs: ["lost-car-keys"] },
      ],
    },
    relatedSlugs: ["lost-car-keys"],
    isActive: true,
    position: 5,
    publishedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },

  // -------------------------------------------------------------------------
  {
    slug: "office-lockout",
    title: "Office Lockout",
    h1: "Office Lockout — Commercial Locksmith, Verified and On the Way",
    metaTitle: "Office Lockout Commercial Locksmith | LockSafe UK",
    metaDescription:
      "Commercial locksmiths for office, retail and warehouse lockouts. Verified, insured, GPS-tracked. Itemised VAT invoice every job.",
    intro:
      "Staff outside, deliveries on the way, alarm about to go off. We send a verified commercial locksmith with an itemised VAT invoice for your finance team.",
    seoCopy: `<h2>Commercial isn't residential — make sure your bidder knows that</h2>
<p>Office and retail premises often have <strong>multi-point commercial locks, access-control systems, panic bars, and shutters</strong> — none of which behave like a domestic UPVC door. Filter for commercial-capable locksmiths and make sure the bidder mentions the specific hardware on your door (e.g. "Briton 5400 panic bar", "Adams Rite 4710 deadlatch").</p>
<h2>VAT invoice and paper trail</h2>
<p>Every LockSafe job generates a VAT invoice automatically (where the locksmith is VAT-registered), plus a GPS arrival timestamp, photos and digital sign-off. Drop straight into your facilities ticket.</p>`,
    emotionalHook: "Office locked, team outside? Commercial locksmith en route.",
    heroSubcopy:
      "Verified commercial locksmiths with VAT invoice, GPS arrival, and timestamped paper trail for your facilities team.",
    pillarKeyword: "commercial-locksmith",
    intentTags: ["commercial", "office", "business", "locked-out"],
    serviceFilter: { serviceSlugs: ["commercial-locksmith", "emergency-locksmith", "locked-out"] },
    faqs: [
      {
        question: "Do you handle access-control and panic-bar issues?",
        answer:
          "Yes — filter your job to 'commercial' and only locksmiths with the relevant experience can bid. Mention the hardware brand in the job description for the fastest, most accurate quote.",
      },
      {
        question: "Will I get a VAT invoice?",
        answer:
          "When the locksmith you accept is VAT-registered, yes — generated automatically as a PDF on job completion.",
      },
    ],
    blocks: {
      segments: [],
      aiSearchQA: [],
      trustConfidence: [
        {
          topic: "verification",
          title: "Commercial-grade locksmiths",
          body: "Public liability insurance is verified before any bid can be placed on a commercial job.",
        },
        {
          topic: "paper-trail",
          title: "Facilities-ready paperwork",
          body: "VAT invoice + GPS + photos + digital signature on every job. Slot straight into your CAFM ticket.",
        },
      ],
      socialProofClusters: [],
      relatedClusters: [
        { heading: "Related commercial scenarios", slugs: ["safe-stuck-shut"] },
      ],
    },
    relatedSlugs: ["safe-stuck-shut"],
    isActive: true,
    position: 6,
    publishedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-11T00:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

export const getAllIntentLandingSlugs = (): string[] =>
  INTENT_LANDINGS.filter((l) => l.isActive).map((l) => l.slug);

export const getIntentLandingBySlug = (slug: string): IntentLanding | undefined =>
  INTENT_LANDINGS.find((l) => l.slug === slug && l.isActive);

export const getActiveIntentLandings = (): IntentLanding[] =>
  INTENT_LANDINGS.filter((l) => l.isActive).sort((a, b) => a.position - b.position);
