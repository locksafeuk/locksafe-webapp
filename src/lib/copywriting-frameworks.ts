/**
 * Elite Copywriting Frameworks (Patel + Deiss)
 *
 * Two principal authors (replacing Welsh / Brunson / Cole / Sinek):
 * - Neil Patel — Data-driven hooks, search-intent matching, SEO-grade promises
 * - Ryan Deiss — Customer Value Journey, Before-After-Bridge, PAS, conversion math
 *
 * Each author exposes TWO variant flavours, giving the AI Ad Manager exactly four
 * distinct copy variations per generation request:
 *
 *   1. Neil Patel — Data-Driven Hook              (NP-DDH)
 *   2. Neil Patel — Search-Intent Promise         (NP-SIP)
 *   3. Ryan Deiss  — Before / After / Bridge      (RD-BAB)
 *   4. Ryan Deiss  — Problem-Agitate-Solve + CVJ  (RD-PAS)
 *
 * Backward-compat exports (`JUSTIN_WELSH_HOOKS`, `RUSSELL_BRUNSON_FRAMEWORKS`,
 * `NICHOLAS_COLE_FRAMEWORKS`, `SIMON_SINEK_FRAMEWORKS`) are mapped to the new
 * frameworks so `organic-content.ts` and any other legacy callers keep working
 * while serving Patel/Deiss-style content.
 */

// ====================================
// NEIL PATEL — DATA-DRIVEN HOOK (NP-DDH)
// Specific stat → curiosity gap → benefit promise.
// ====================================

export const NEIL_PATEL_DATA_DRIVEN = {
  id: "neil-patel-data-driven",
  author: "Neil Patel",
  variant: "Data-Driven Hook",
  description:
    "Lead with a specific, surprising number. Open a curiosity loop. Close with a clear benefit and proof.",

  // Pattern interrupts (kept for backward-compat shape with the legacy
  // JUSTIN_WELSH_HOOKS.patternInterrupts consumer in organic-content.ts).
  patternInterrupts: [
    {
      formula: "[X%] of [audience] [surprising behaviour]. Here's what that costs them.",
      example: "73% of UK lockout victims pay more than the original quote. Here's what it costs them.",
      when: "Anchor with a credible-feeling stat, then hint at hidden cost.",
    },
    {
      formula: "We analysed [N] [data points]. The pattern is clear: [insight].",
      example: "We analysed 2,500 LockSafe jobs. The pattern is clear: undocumented quotes triple in 1 in 4 cases.",
      when: "Authority through volume + analysis.",
    },
    {
      formula: "[Specific number] [unit] could save you [outcome].",
      example: "5 minutes of comparing verified locksmiths could save you £290.",
      when: "Time-for-money trade hook.",
    },
    {
      formula: "[Year] is when [trend tipped]. Are you still doing [old way]?",
      example: "2024 is when locksmith scams hit a 5-year high. Are you still googling 'locksmith near me'?",
      when: "Date-anchored urgency.",
    },
    {
      formula: "Most [audience] do [common action]. The top [smaller %] do [better action].",
      example: "Most homeowners call the first locksmith Google shows. The top 10% compare verified quotes first.",
      when: "Aspirational segmentation hook.",
    },
  ],

  // One-liner conversion formulas (kept for backward-compat shape).
  oneLinerFormulas: [
    {
      formula: "[Stat]. [Mechanism]. [Outcome you want].",
      example: "2,500 protected jobs. Documented quotes. £0 in scam losses.",
      purpose: "Stat → mechanism → claim.",
    },
    {
      formula: "If [trigger] happens, [data-driven recommendation].",
      example: "If you're locked out tonight, do this before you call anyone.",
      purpose: "Triggered prescription.",
    },
    {
      formula: "[Action] in [time]. Save [amount] on average.",
      example: "Compare verified locksmiths in 60 seconds. Save £180 on average.",
      purpose: "Quantified value promise.",
    },
  ],

  // Curiosity gaps (kept for backward-compat shape).
  curiosityGaps: [
    "Here's the number nobody in the locksmith industry wants you to know:",
    "We pulled the data on 2,500 locksmith jobs. One stat changes everything:",
    "The £25 step that prevents 90% of lockout overcharges:",
    "Why the cheapest 'quote' is almost always the most expensive job:",
    "What happens in the 8 minutes between 'I'm here' and the invoice:",
  ],

  proofPattern: {
    description: "Patel-style proof stack: stat + source + mechanism + outcome.",
    examples: [
      "2,500+ jobs documented (LockSafe internal data) → £0 scam losses → average customer saves £180.",
      "70% of locksmith applicants rejected (DBS + insurance + credentials) → only verified pros reach you.",
      "Average response 15 minutes (90-day rolling) → faster than the typical 'priority' call-out.",
    ],
  },
};

// ====================================
// NEIL PATEL — SEARCH-INTENT PROMISE (NP-SIP)
// Mirror the searcher's question → answer it in the headline.
// ====================================

export const NEIL_PATEL_SEARCH_INTENT = {
  id: "neil-patel-search-intent",
  author: "Neil Patel",
  variant: "Search-Intent Promise",
  description:
    "Mirror the exact question the audience is typing into Google, then deliver the answer (and the next step) in a single tight unit.",

  intentMatchFormulas: [
    {
      formula: "How to [user goal] without [user fear] (in [timeframe])",
      example: "How to find an honest locksmith without getting overcharged (in under 60 seconds)",
    },
    {
      formula: "[User question]? [Direct answer]. [Proof]. [Next step].",
      example: "Need a locksmith now? Get a verified one in 15 min. 2,500+ jobs, £0 scam losses. Request quotes →",
    },
    {
      formula: "The [year] guide to [user goal] — [unique mechanism]",
      example: "The 2026 guide to safe locksmith hire — protected by legal documentation.",
    },
    {
      formula: "[Best/Cheapest/Fastest] [service] near me, but [unique twist]",
      example: "Fastest locksmith near you — but every job creates legal proof.",
    },
  ],

  // Headline templates Patel uses across SEO + paid social.
  headlineFormulas: [
    {
      formula: "[Number] [Things] You Need Before You [Action]",
      example: "5 Things You Need Before You Call a Locksmith",
    },
    {
      formula: "How [Outcome] Without [Fear / Cost]",
      example: "How to Get a Locksmith Without Getting Scammed",
    },
    {
      formula: "The Real Reason [Problem] (And the Fix)",
      example: "The Real Reason Locksmith Quotes Triple on Arrival (And the Fix)",
    },
    {
      formula: "[Question Searcher Types] — Solved",
      example: "Locked Out at Night and Worried About Being Ripped Off? Solved.",
    },
  ],

  // Patel "value loop" close — re-state benefit, then reduce friction.
  valueLoopClose: [
    "Free for customers. £0 scam losses across 2,500 jobs. Compare quotes before you commit.",
    "Verified locksmiths. Documented quotes. Refund if they don't show. Start a request →",
    "No card required to compare. Pay only when you accept a quote you approve.",
  ],
};

// ====================================
// RYAN DEISS — BEFORE / AFTER / BRIDGE (RD-BAB)
// Pain state → desired state → product as bridge.
// ====================================

export const RYAN_DEISS_BAB = {
  id: "ryan-deiss-before-after-bridge",
  author: "Ryan Deiss",
  variant: "Before / After / Bridge",
  description:
    "Walk the reader from pain (Before) to relief (After) using LockSafe as the literal Bridge. Direct-response gold for emergency intent.",

  structure: {
    before: "Where they are right now — locked out, anxious, no idea who to trust.",
    after:
      "Where they want to be — back inside, sure they paid a fair price, with a PDF receipt to prove it.",
    bridge:
      "LockSafe as the bridge — verified locksmiths, quote you approve before work starts, refund if they no-show.",
  },

  locksafeExample: {
    before:
      "It's 2am. The kids are crying. You've called three locksmiths and one wants £400 cash, no receipt.",
    after:
      "20 minutes later you're inside. You paid £90, the quote you actually agreed to, and a PDF report is already in your email.",
    bridge:
      "LockSafe UK — verified locksmiths, quote you approve before any work starts, automatic refund if they don't arrive.",
  },

  babPrompts: [
    {
      formula: "Before: [pain].\nAfter: [relief].\nBridge: [product].",
      example:
        "Before: You're locked out and the locksmith just doubled the quote.\nAfter: You agree the price first, in writing.\nBridge: LockSafe verifies, documents and refunds — automatically.",
    },
    {
      formula: "Imagine if [pain] never happened. With [product] it doesn't have to.",
      example: "Imagine if locksmith overcharging never happened. With LockSafe it doesn't have to.",
    },
  ],

  riskReversal: [
    "Automatic refund if a verified locksmith doesn't arrive within the agreed time.",
    "Decline the quote on the doorstep? Pay only the £25–49 assessment fee. No pressure.",
    "Every job creates a legal PDF — quote, GPS arrival, photos, your digital signature.",
    "If anything goes wrong, you have documented evidence on day one.",
  ],
};

// ====================================
// RYAN DEISS — PAS + CUSTOMER VALUE JOURNEY (RD-PAS)
// Problem → Agitate → Solve, mapped to awareness stages.
// ====================================

export const RYAN_DEISS_PAS = {
  id: "ryan-deiss-pas-cvj",
  author: "Ryan Deiss",
  variant: "PAS + Customer Value Journey",
  description:
    "Classic Problem → Agitate → Solve, calibrated to the prospect's awareness stage so the same offer hits at every step of the funnel.",

  // Customer Value Journey — used by the audience generator too.
  awarenessStages: [
    {
      stage: "unaware",
      description:
        "Doesn't know locksmith fraud is a category — sees it as 'bad luck' if it happens.",
      adAngle: "Education-first. Stats + stories that name the category.",
    },
    {
      stage: "problem-aware",
      description: "Knows lockouts go wrong, but assumes there's no real fix.",
      adAngle: "Agitate the consequences (no proof, no recourse) and tease the mechanism.",
    },
    {
      stage: "solution-aware",
      description: "Looking for a 'trusted' locksmith but doesn't know how to verify trust.",
      adAngle: "Compare 'Googled locksmith' vs 'documented LockSafe job' side-by-side.",
    },
    {
      stage: "product-aware",
      description: "Has heard of LockSafe, weighing it against alternatives.",
      adAngle: "Specific differentiators: refund guarantee, PDF report, approve-before-work quote.",
    },
    {
      stage: "most-aware",
      description: "Locked out RIGHT NOW or expecting to need a locksmith soon.",
      adAngle: "Direct CTA, 15-min response, request flow in two taps.",
    },
  ],

  pasTemplates: [
    {
      formula: "PROBLEM: [pain]\nAGITATE: [worst case]\nSOLVE: [mechanism + CTA]",
      example:
        "PROBLEM: You're locked out and the quote on the doorstep is double what you were told.\nAGITATE: No paperwork, no receipts, no way to prove it later.\nSOLVE: LockSafe locks the quote in writing before any work starts. Request →",
    },
    {
      formula: "[They feel pain]. [It gets worse]. [Here's the fix that documents itself].",
      example:
        "Lockout fees keep climbing. The cash-only ones are the worst. LockSafe makes every job auditable in writing — refund guaranteed.",
    },
  ],

  // Direct-response close lines.
  drCloseLines: [
    "Free for customers. Refund if they don't show. Request a quote →",
    "Two taps to a verified locksmith. PDF proof in your inbox.",
    "100% free to compare. £0 scam losses across 2,500+ documented jobs.",
  ],
};

// ====================================
// COMBINED POWER FRAMEWORKS
// ====================================

export const POWER_FRAMEWORKS = {
  // The Ultimate Ad Formula combining Patel + Deiss
  ultimateAdFormula: {
    components: [
      { phase: "HOOK", source: "Neil Patel", action: "Data-driven hook with a specific number." },
      { phase: "INTENT", source: "Neil Patel", action: "Mirror the exact searcher question." },
      { phase: "BEFORE", source: "Ryan Deiss", action: "Concrete pain state." },
      { phase: "AFTER", source: "Ryan Deiss", action: "Vivid desired outcome." },
      { phase: "BRIDGE", source: "Ryan Deiss", action: "LockSafe mechanism + risk reversal." },
      { phase: "CTA", source: "Ryan Deiss", action: "Direct response, low friction next step." },
    ],
    locksafeExample: {
      hook: "73% of UK lockout victims pay more than the original quote.",
      intent: "Need a locksmith without getting overcharged?",
      before: "It's 2am. Three locksmiths, three different prices, no paperwork.",
      after: "You pay £90 — the price you agreed to — and a PDF receipt lands in your inbox.",
      bridge:
        "LockSafe verifies the locksmith, locks the quote in writing before any work starts, and refunds you automatically if they don't arrive.",
      cta: "Compare verified locksmiths in 60 seconds — free for customers.",
    },
  },

  // Emotional Escalation Ladder (Deiss style)
  emotionalLadder: {
    description: "Move the reader from cold awareness to action without skipping a stage.",
    stages: [
      { emotion: "Recognition", copy: "You've heard the £50-becomes-£300 stories." },
      { emotion: "Agitation", copy: "It's almost always cash, no receipt, no recourse." },
      { emotion: "Hope", copy: "What if every quote was locked in writing before any work started?" },
      { emotion: "Proof", copy: "2,500+ jobs documented. £0 scam losses. PDF on every invoice." },
      { emotion: "Confidence", copy: "Refund guarantee built into the platform — not a promise, a process." },
      { emotion: "Action", copy: "Compare verified locksmiths in 60 seconds. Free to customers." },
    ],
  },

  // Problem Stack (Deiss agitation device)
  problemStack: {
    description: "Stack pains until the solution feels inevitable.",
    problems: [
      "Locked out at night. Every locksmith ad looks identical.",
      "Quoted £80, charged £380. Nothing in writing.",
      "Wanted a receipt? 'Cash only, mate.'",
      "Tried to dispute it later? Your word against theirs.",
    ],
    pivot: "There's now a platform built specifically to prevent this.",
    solution: "LockSafe UK: verified locksmiths, quote in writing, refund if they don't show, PDF on every job.",
  },

  // Future Pacing (Deiss conversion device)
  futurePacing: {
    description: "Help the reader live the post-purchase reality.",
    formula: "Imagine [positive scenario]. That's what [product] gives you.",
    examples: [
      "Imagine getting locked out and NOT worrying about being scammed. That's LockSafe.",
      "Imagine a PDF that proves exactly what was quoted, agreed and signed. That's every LockSafe job.",
      "Imagine an automatic refund when a locksmith no-shows. No calls. No disputes. Just your money back.",
    ],
  },
};

// ====================================
// AD COPY TEMPLATES (kept; rewritten in Patel/Deiss tone)
// ====================================

export const AD_COPY_TEMPLATES = {
  emergency: [
    {
      angle: "Data-Driven Speed",
      primaryText:
        "73% of UK lockout victims pay more than the original quote.\n\nLockSafe gets you a verified locksmith in 15 minutes — and locks the quote in writing before any work starts.\n\nGPS arrival. Approved quote. Digital signature. PDF receipt.\n\nFree for customers. Refund guaranteed if they don't show.",
      headline: "Locked Out? Don't Get Overcharged.",
      callToAction: "GET_QUOTE",
    },
    {
      angle: "Before/After/Bridge",
      primaryText:
        "Before: It's 2am, the kids are crying, the locksmith just doubled the quote.\n\nAfter: 20 minutes later you're inside. You paid the price you agreed. A PDF receipt is in your inbox.\n\nBridge: LockSafe — verified locksmiths, quote you approve before any work starts, automatic refund if they no-show.",
      headline: "From Locked Out to Locked In Writing.",
      callToAction: "GET_QUOTE",
    },
  ],
  trust: [
    {
      angle: "Search-Intent Promise",
      primaryText:
        "Looking for an honest locksmith near you?\n\n→ Verified pros only (we reject 70% of applicants)\n→ See the quote BEFORE work starts\n→ Decline = pay only the £25–49 assessment fee\n→ PDF proof of every job\n\n2,500+ jobs. £0 scam losses.",
      headline: "How to Hire a Locksmith Without Getting Scammed",
      callToAction: "LEARN_MORE",
    },
    {
      angle: "PAS Stack",
      primaryText:
        "Heard the horror stories?\n\n£50 quotes turning into £300. Cash-only, no receipt. 'Your word against theirs' when you complain.\n\nThere's a platform built specifically to stop this.\n\nLockSafe UK: verified locksmiths, quote locked in writing, automatic refund if they don't arrive, PDF on every job.",
      headline: "Stop Locksmith Scams. Get Legal Proof.",
      callToAction: "LEARN_MORE",
    },
  ],
  control: [
    {
      angle: "Customer Choice",
      primaryText:
        "Finally, a locksmith service where YOU're in control:\n\n→ YOU compare verified pros (fee, ETA, reviews)\n→ YOU see the quote BEFORE work starts\n→ YOU accept or decline\n→ YOU sign digitally to confirm\n\nDecline the quote? Pay only the £25–49 assessment fee. No pressure.",
      headline: "Your Job. Your Quote. Your Choice.",
      callToAction: "GET_QUOTE",
    },
  ],
  benefit: [
    {
      angle: "What You Actually Get",
      primaryText:
        "What if hiring a locksmith was actually safe?\n\n✓ 15-min average response\n✓ Verified & DBS-checked pros\n✓ Quote locked in writing BEFORE work\n✓ Legal PDF on every job\n✓ Automatic refund if they don't arrive\n\n100% free for customers.",
      headline: "Fast. Documented. Free for Customers.",
      callToAction: "GET_QUOTE",
    },
  ],
  story: [
    {
      angle: "Founder Origin (Deiss BAB)",
      primaryText:
        "3 years ago my mother paid £380 for a £90 lockout job. Cash. No receipt. 'Your word against theirs.'\n\nThat's why we built LockSafe UK: every job locks the quote in writing first, every job creates a PDF, every no-show triggers an automatic refund.\n\nNever again.",
      headline: "Built So Your Word Is Never Against Theirs.",
      callToAction: "LEARN_MORE",
    },
  ],
  whyLed: [
    {
      angle: "CVJ-Aware",
      primaryText:
        "Most people don't know locksmith fraud is its own category — until it happens to them.\n\nWe believe being locked out shouldn't mean being overcharged.\n\nLockSafe locks the quote in writing, documents the job end-to-end and refunds you automatically if the locksmith doesn't show up.\n\nThat's not a promise. That's a process.",
      headline: "We Built Protection Into the Process.",
      callToAction: "LEARN_MORE",
    },
  ],
};

// ====================================
// HEADLINE POWER VARIATIONS
// ====================================

export const POWER_HEADLINES = {
  urgency: [
    "Locked Out? Verified Help in 15 Minutes.",
    "Don't Just Find a Locksmith. Find a Documented One.",
    "Emergency Locksmith + Quote Locked in Writing.",
    "Every Minute Matters. So Does Your Receipt.",
  ],
  trust: [
    "How to Hire a Locksmith Without Getting Scammed",
    "2,500+ Documented Jobs. £0 Scam Losses.",
    "Quote Locked in Writing Before Any Work Starts",
    "70% of Locksmith Applicants Rejected. Here's Why.",
  ],
  control: [
    "See the Quote First. Then Decide.",
    "Your Locksmith. Your Quote. Your Receipt.",
    "Approve or Decline. No Pressure. Ever.",
    "Finally, You're in Control of the Bill.",
  ],
  benefit: [
    "Fast Response. Documented Quote. Free for Customers.",
    "15 Min Response + Refund Guarantee + PDF Proof",
    "What If Hiring a Locksmith Was Actually Safe?",
    "The Locksmith Service That Documents Itself",
  ],
  fear: [
    "The £50 Quote That Became £380",
    "How to Avoid the 'Cash-Only Cowboy' Trap",
    "Stop. Before You Google 'Locksmith Near Me'…",
    "73% of UK Lockout Victims Pay More Than the Quote",
  ],
  curiosity: [
    "What the Locksmith Industry Doesn't Want You to Know",
    "The 60-Second Step That Prevents Most Lockout Overcharges",
    "Why Some Locksmiths Refuse to Use This Platform",
    "The Stat That Changes How You Hire a Locksmith",
  ],
};

// ====================================
// CALL TO ACTION VARIATIONS
// ====================================

export const POWER_CTAS = {
  emergency: [
    { text: "Get Help Now", subtext: "Verified locksmith in 15 min" },
    { text: "Find Documented Locksmith", subtext: "GPS, quote in writing, refund guaranteed" },
    { text: "Request Emergency Help", subtext: "Verified pros only" },
  ],
  consideration: [
    { text: "See How It Works", subtext: "2 min to understand" },
    { text: "Learn More", subtext: "How the documentation works" },
    { text: "Compare Locksmiths", subtext: "Verified, rated, documented" },
  ],
  conversion: [
    { text: "Get Documented Quotes", subtext: "Approve before any work starts" },
    { text: "Request Locksmith", subtext: "100% free for customers" },
    { text: "Start Protected Request", subtext: "Automatic refund guarantee" },
  ],
};

// ====================================
// BACKWARD-COMPAT ALIASES
// Legacy exports used by organic-content.ts and other callers.
// They keep the SHAPE of the original Welsh/Brunson/Cole/Sinek constants
// but serve Patel/Deiss content so the entire stack speaks one voice.
// ====================================

// Alias 1: JUSTIN_WELSH_HOOKS  →  Neil Patel data-driven hooks
export const JUSTIN_WELSH_HOOKS = {
  patternInterrupts: NEIL_PATEL_DATA_DRIVEN.patternInterrupts,
  oneLinerFormulas: NEIL_PATEL_DATA_DRIVEN.oneLinerFormulas,
  curiosityGaps: NEIL_PATEL_DATA_DRIVEN.curiosityGaps,
};

// Alias 2: RUSSELL_BRUNSON_FRAMEWORKS  →  Ryan Deiss BAB
export const RUSSELL_BRUNSON_FRAMEWORKS = {
  hookStoryOffer: {
    description: "Before / After / Bridge — Deiss replacement for Hook-Story-Offer.",
    structure: {
      hook: RYAN_DEISS_BAB.structure.before,
      story: RYAN_DEISS_BAB.structure.after,
      offer: RYAN_DEISS_BAB.structure.bridge,
    },
    locksafeExample: {
      hook: RYAN_DEISS_BAB.locksafeExample.before,
      story: RYAN_DEISS_BAB.locksafeExample.after,
      offer: RYAN_DEISS_BAB.locksafeExample.bridge,
    },
  },
  epiphanyBridge: {
    description: "Customer Value Journey awareness stages (Deiss).",
    stages: RYAN_DEISS_PAS.awarenessStages.map((s) => `${s.stage}: ${s.description}`),
    locksafeJourney: {
      backstory: "Locked out at night. Three locksmiths, three prices, none in writing.",
      desire: "Get inside. Pay a fair price. Have something to show for it.",
      wall: "Cash-only quotes triple on the doorstep. No receipts.",
      epiphany: "The quote should be locked in writing BEFORE any work starts.",
      plan: "LockSafe verifies the locksmith and locks the quote first.",
      achievement: "PDF receipt, GPS arrival, automatic refund if they don't show.",
      transformation: "You stop hoping. You start documenting.",
    },
  },
  urgencyTriggers: [
    {
      type: "Situation urgency",
      formula: "You're [situation]. Every minute matters.",
      example: "You're locked out. Every minute and every pound matters.",
    },
    {
      type: "Risk urgency",
      formula: "The longer you wait, the higher the risk of [bad outcome].",
      example: "The longer you wait, the higher the chance the next quote is cash-only.",
    },
    {
      type: "Opportunity urgency",
      formula: "Right now you can [benefit]. Tomorrow you might not have the choice.",
      example: "Right now you can compare documented locksmiths. Mid-emergency, you can't.",
    },
  ],
  riskReversal: RYAN_DEISS_BAB.riskReversal,
};

// Alias 3: NICHOLAS_COLE_FRAMEWORKS  →  Neil Patel search-intent + proof stack
export const NICHOLAS_COLE_FRAMEWORKS = {
  categoryDesign: {
    description:
      "Patel positioning: own the search-intent category for 'honest locksmith near me'.",
    ourCategory: "Documented Locksmith Hire",
    positioningStatement:
      "LockSafe UK is not 'another locksmith booking site'. It's the UK's first platform that locks the quote in writing before any work starts and creates a legal PDF for every job.",
    categoryCreators: [
      "UK's first documented locksmith hire platform",
      "The only platform that locks the quote in writing before work begins",
      "Not a booking site — a documentation system",
    ],
    differentiators: [
      "Quote in writing before any work starts",
      "GPS arrival + timestamped photos + digital signature + PDF report",
      "Automatic refund if a verified locksmith doesn't arrive",
      "Free for customers — pay only when you accept a quote you approve",
    ],
  },
  specificityRules: {
    description: "Patel rule: vague claims are forgettable, specific stats are believable.",
    rules: [
      {
        bad: "Fast response times",
        good: "15-minute average response (90-day rolling)",
        why: "Specific numbers + sample window = credible.",
      },
      {
        bad: "We verify our locksmiths",
        good: "We reject 70% of applicants (DBS + insurance + credentials)",
        why: "Rejection rate signals selectivity.",
      },
      {
        bad: "Thousands of happy customers",
        good: "2,500+ documented jobs with £0 scam losses",
        why: "Zero is an absolute claim — Patel-grade specificity.",
      },
      {
        bad: "Fair prices",
        good: "Quote locked in writing before any work starts. Decline = pay only the £25–49 assessment fee.",
        why: "Show the mechanism, not the marketing.",
      },
    ],
  },
  whyNow: {
    description: "Patel-style intent triggers: answer the searcher's 'why now' in one line.",
    triggers: [
      {
        type: "Immediate search intent",
        formula: "Searching '[query]'? [direct answer + next step].",
        example: "Searching 'locksmith near me'? Compare verified, documented pros in 60 seconds.",
      },
      {
        type: "Awareness shift",
        formula: "Now that you know [data point], [next action].",
        example: "Now that you know 73% of lockouts are overcharged, lock the quote in writing first.",
      },
      {
        type: "Preventive action",
        formula: "Before [bad thing], make sure [protective action].",
        example: "Before your next lockout, save LockSafe. It's the 60-second step that prevents the bill shock.",
      },
    ],
  },
  headlineFormulas: NEIL_PATEL_SEARCH_INTENT.headlineFormulas,
};

// Alias 4: SIMON_SINEK_FRAMEWORKS  →  Ryan Deiss CVJ + DR closes
export const SIMON_SINEK_FRAMEWORKS = {
  goldenCircle: {
    description:
      "CVJ-aligned 'why' (Deiss): the belief that justifies every product decision.",
    structure: {
      why: "The belief that drives the product.",
      how: "The mechanism that delivers on the belief.",
      what: "The product the user actually buys.",
    },
    locksafe: {
      why:
        "We believe being locked out shouldn't mean being overcharged. Vulnerability shouldn't be monetised.",
      how:
        "Every job locks the quote in writing before work starts, documents arrival via GPS and photos, and refunds automatically on no-show.",
      what:
        "LockSafe UK — a documented locksmith hire platform that's free for customers.",
    },
    messaging: {
      whyFirst:
        "We believe being locked out shouldn't mean being overcharged. That's why every LockSafe job locks the quote in writing first.",
      traditional:
        "We're a locksmith booking platform with verification.",
    },
  },
  purposeStatements: [
    "Built because cash-only doorstep quotes shouldn't be the industry default.",
    "Created so 'your word against theirs' is replaced with 'here's the PDF'.",
    "Designed so the receipt exists before the wrench comes out.",
    "Made for people who've heard one too many lockout horror stories.",
    "Documenting what the industry refused to document.",
  ],
  justCause: {
    description: "Deiss-style North Star: the future state we're funding the platform to reach.",
    locksafe: "A UK where every locksmith job is documented before it begins. No exceptions.",
    howWeGetThere: [
      "Every quote locked in writing before any work starts.",
      "Every job tracked with GPS, photos and digital signatures.",
      "Every no-show refunded automatically — not on request.",
      "An industry standard for documentation, not a marketing claim.",
    ],
  },
  beliefCopy: [
    {
      belief: "We believe vulnerability shouldn't be monetised.",
      proof: "That's why every LockSafe job has a refund guarantee built in — automatic, not on request.",
    },
    {
      belief: "We believe the quote should exist before the wrench comes out.",
      proof: "Every job locks the price in writing before any work starts. Decline = pay only the assessment fee.",
    },
    {
      belief: "We believe documentation beats trust.",
      proof: "GPS arrival, timestamped photos, digital signature, PDF report — on every single job.",
    },
  ],
};

// ====================================
// EXPORT ALL FRAMEWORKS
// ====================================

export const COPYWRITING_FRAMEWORKS = {
  // New primary frameworks
  neilPatelDataDriven: NEIL_PATEL_DATA_DRIVEN,
  neilPatelSearchIntent: NEIL_PATEL_SEARCH_INTENT,
  ryanDeissBAB: RYAN_DEISS_BAB,
  ryanDeissPAS: RYAN_DEISS_PAS,
  // Combined / shared
  power: POWER_FRAMEWORKS,
  templates: AD_COPY_TEMPLATES,
  headlines: POWER_HEADLINES,
  ctas: POWER_CTAS,
  // Legacy aliases (point to Patel/Deiss data; preserved for backward compatibility)
  justinWelsh: JUSTIN_WELSH_HOOKS,
  russellBrunson: RUSSELL_BRUNSON_FRAMEWORKS,
  nicholasCole: NICHOLAS_COLE_FRAMEWORKS,
  simonSinek: SIMON_SINEK_FRAMEWORKS,
};

export default COPYWRITING_FRAMEWORKS;
