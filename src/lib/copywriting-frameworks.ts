/**
 * Elite Copywriting Frameworks
 *
 * Incorporating proven strategies from:
 * - Justin Welsh: Hook formulas, pattern interrupts, one-liner power
 * - Russell Brunson: Hook-Story-Offer, Epiphany Bridge, urgency
 * - Nicholas Cole: Category Design, specificity, "Why Now"
 * - Simon Sinek: Start with Why, Golden Circle
 *
 * These frameworks are specifically adapted for LockSafe UK's anti-fraud positioning.
 */

// ====================================
// JUSTIN WELSH FRAMEWORKS
// LinkedIn content mastery, pattern interrupts
// ====================================

export const JUSTIN_WELSH_HOOKS = {
  // Pattern Interrupt Openers - Stop the scroll
  patternInterrupts: [
    {
      formula: "Most people think [common belief]. They're wrong.",
      example: "Most people think all locksmiths charge fair prices. They're wrong.",
      when: "Challenge conventional thinking",
    },
    {
      formula: "I spent [time] learning [thing]. Here's what nobody tells you:",
      example: "I spent 3 years building a locksmith platform. Here's what nobody tells you about the industry:",
      when: "Establish authority through experience",
    },
    {
      formula: "Stop [common action]. Start [better action].",
      example: "Stop calling random locksmiths. Start using protected booking.",
      when: "Direct behavioral shift",
    },
    {
      formula: "The [industry] doesn't want you to know this:",
      example: "The locksmith industry doesn't want you to know this:",
      when: "Insider knowledge angle",
    },
    {
      formula: "[Number] years ago, [event]. It changed everything.",
      example: "3 years ago, my mother was scammed by a locksmith. It changed everything.",
      when: "Origin story hook",
    },
  ],

  // One-Liner Power (Justin's signature)
  oneLinerFormulas: [
    {
      formula: "[Bold claim]. [Proof point].",
      example: "We've had £0 in scam losses. Because every job is documented.",
      purpose: "Authority through specificity",
    },
    {
      formula: "[Problem statement]? [Solution in 3 words].",
      example: "Worried about overcharging? See quotes first.",
      purpose: "Quick problem-solution",
    },
    {
      formula: "[Outcome they want] without [thing they fear].",
      example: "Get a locksmith without getting scammed.",
      purpose: "Promise + objection handling",
    },
    {
      formula: "The difference between [bad outcome] and [good outcome] is [your solution].",
      example: "The difference between a £90 job and a £400 scam is documentation.",
      purpose: "Value positioning",
    },
  ],

  // Curiosity Gaps (Welsh's scroll-stoppers)
  curiosityGaps: [
    "Here's the thing nobody tells you about calling a locksmith:",
    "I built LockSafe UK after this happened to my family:",
    "Most people wait until it's too late. Here's why:",
    "This one change prevents 99% of locksmith scams:",
    "The £300 you might lose (and how to prevent it):",
  ],
};

// ====================================
// RUSSELL BRUNSON FRAMEWORKS
// Hook-Story-Offer, Epiphany Bridge
// ====================================

export const RUSSELL_BRUNSON_FRAMEWORKS = {
  // Hook-Story-Offer (core framework)
  hookStoryOffer: {
    description: "Lead with intrigue, connect with story, close with irresistible offer",
    structure: {
      hook: "Pattern interrupt + curiosity gap",
      story: "Relatable struggle → epiphany moment → transformation",
      offer: "Clear value + urgency + risk reversal",
    },
    locksafeExample: {
      hook: "My 78-year-old mother was quoted £90. She paid £380.",
      story: "When we complained, it was her word against the locksmith's. No proof. No recourse. That moment changed everything. We built LockSafe UK - the UK's first platform where every job creates legal proof.",
      offer: "Get protected emergency help in 15 minutes. Full documentation. Automatic refund if they don't show. Request now →",
    },
  },

  // The Epiphany Bridge (emotional transformation)
  epiphanyBridge: {
    description: "Take reader through same realization you had",
    stages: [
      "Backstory: What was life like before?",
      "Desire: What did you want?",
      "Wall: What obstacles did you face?",
      "Epiphany: What breakthrough changed everything?",
      "Plan: What's the new way?",
      "Achievement: What results did you get?",
      "Transformation: Who have you become?",
    ],
    locksafeJourney: {
      backstory: "When you're locked out, you're desperate. You'll pay anything.",
      desire: "You just want to get inside. Quickly. Safely. Fairly.",
      wall: "But how do you know if the locksmith is legitimate? What if they overcharge?",
      epiphany: "What if every job created legal proof? GPS, photos, quotes you approve, signatures?",
      plan: "That's exactly what we built. Documentation that protects everyone.",
      achievement: "2,500+ protected jobs. £0 scam losses. 100% dispute resolution.",
      transformation: "Your word is never against theirs again.",
    },
  },

  // Urgency Triggers (ethical urgency)
  urgencyTriggers: [
    {
      type: "Situation urgency",
      formula: "You're [situation]. Every minute matters.",
      example: "You're locked outside. Every minute matters.",
    },
    {
      type: "Risk urgency",
      formula: "The longer you wait, the higher the risk of [bad outcome].",
      example: "The longer you wait, the higher the risk of calling an unverified locksmith.",
    },
    {
      type: "Opportunity urgency",
      formula: "Right now, you can [benefit]. Tomorrow, you might not have the choice.",
      example: "Right now, you can compare verified locksmiths. In an emergency, you won't have time.",
    },
  ],

  // Risk Reversal (guarantee frameworks)
  riskReversal: [
    "Automatic refund if locksmith doesn't arrive within agreed time + 30 min",
    "Decline the quote? Pay only the assessment fee. No pressure.",
    "Every job creates a PDF report. Proof forever.",
    "If anything goes wrong, you have documented evidence.",
  ],
};

// ====================================
// NICHOLAS COLE FRAMEWORKS
// Category Design, Specificity, "Why Now"
// ====================================

export const NICHOLAS_COLE_FRAMEWORKS = {
  // Category Design (create new category, own it)
  categoryDesign: {
    description: "Don't compete in existing categories. Create and own a new one.",
    ourCategory: "Anti-Fraud Locksmith Platform",
    positioningStatement: "LockSafe UK is NOT 'another locksmith booking site'. We're the UK's first and only platform that prevents price scams through legally-binding documentation.",
    categoryCreators: [
      "UK's first anti-fraud locksmith platform",
      "The only platform that creates legal proof for every job",
      "Not a booking site - a protection system",
    ],
    differentiators: [
      "GPS tracking + timestamped photos + digital signatures + PDF reports",
      "See quote BEFORE work starts - accept or decline",
      "Automatic refund guarantee",
      "Your word is never against theirs again",
    ],
  },

  // Specificity (numbers, details, proof)
  specificityRules: {
    description: "Specificity creates believability. Vague claims are forgettable.",
    rules: [
      {
        bad: "Fast response times",
        good: "15-minute average response time",
        why: "Specific numbers are memorable and believable",
      },
      {
        bad: "We verify our locksmiths",
        good: "We reject 70% of locksmith applicants (DBS + insurance + qualifications)",
        why: "Rejection rate shows selectivity",
      },
      {
        bad: "Thousands of happy customers",
        good: "2,500+ protected jobs with £0 scam losses",
        why: "Zero is powerful - absolute claim",
      },
      {
        bad: "Fair prices",
        good: "See itemised quote before work starts. Decline = pay only £25-49 assessment fee.",
        why: "Show the mechanism, not just claim the benefit",
      },
    ],
  },

  // "Why Now" Framework
  whyNow: {
    description: "Give readers a reason to act NOW, not later",
    triggers: [
      {
        type: "Immediate problem",
        formula: "You're [situation]. You need [solution] now.",
        example: "You're locked out at 2am. You need a verified locksmith now.",
      },
      {
        type: "Awareness shift",
        formula: "Now that you know [truth], you can't go back to [old way].",
        example: "Now that you know locksmiths can document everything, why would you call one who doesn't?",
      },
      {
        type: "Preventive action",
        formula: "Before [bad thing happens], make sure [protective action].",
        example: "Before your next lockout, know about LockSafe. It could save you hundreds.",
      },
    ],
  },

  // Headlines that create intrigue
  headlineFormulas: [
    {
      formula: "The [Unexpected Noun] Approach to [Desired Outcome]",
      example: "The Legal Documentation Approach to Hiring a Locksmith",
    },
    {
      formula: "[Number] Reasons Why [Common Practice] is [Negative]",
      example: "3 Reasons Why Googling 'Locksmith Near Me' is Risky",
    },
    {
      formula: "How to [Achieve Outcome] Without [Common Negative]",
      example: "How to Get Emergency Locksmith Help Without Getting Scammed",
    },
    {
      formula: "What [Authority] Knows About [Topic] That You Don't",
      example: "What Trading Standards Knows About Locksmith Scams That You Don't",
    },
  ],
};

// ====================================
// SIMON SINEK FRAMEWORKS
// Start with Why, Golden Circle
// ====================================

export const SIMON_SINEK_FRAMEWORKS = {
  // Golden Circle (Why → How → What)
  goldenCircle: {
    description: "People don't buy WHAT you do, they buy WHY you do it",
    structure: {
      why: "The belief or cause that drives you",
      how: "The unique way you deliver on that belief",
      what: "The product or service you offer",
    },
    locksafe: {
      why: "We believe no one should be taken advantage of when they're vulnerable and desperate. Being locked out shouldn't mean being ripped off.",
      how: "We created a platform where every job produces legal documentation - GPS, photos, quotes you approve, digital signatures. Your protection is automated, not optional.",
      what: "LockSafe UK connects you with verified locksmiths. But more importantly, it protects you with proof.",
    },
    messaging: {
      whyFirst: "We believe being locked out shouldn't mean being ripped off. That's why we built the UK's first anti-fraud locksmith platform.",
      traditional: "We're a locksmith booking platform with verification and documentation.", // Less compelling
    },
  },

  // Purpose-Driven Messaging
  purposeStatements: [
    "Built because we were tired of scam stories.",
    "Created after seeing vulnerable people exploited.",
    "Designed so your word is never against theirs again.",
    "Made for people who've heard the horror stories.",
    "Protecting customers because the industry wouldn't.",
  ],

  // "Just Cause" Framework
  justCause: {
    description: "A vision of a future state that doesn't exist yet",
    locksafe: "A UK where no one gets scammed by a locksmith. Ever.",
    howWeGetThere: [
      "Legal documentation for every job",
      "Transparent pricing before commitment",
      "Automatic protections, not just promises",
      "Industry-wide standard for accountability",
    ],
  },

  // Belief-Driven Copy
  beliefCopy: [
    {
      belief: "We believe vulnerable people shouldn't be exploited.",
      proof: "That's why we built automatic refund guarantees and legal documentation.",
    },
    {
      belief: "We believe your word should never be against theirs.",
      proof: "GPS tracking, timestamped photos, digital signatures, PDF reports. Proof forever.",
    },
    {
      belief: "We believe you should control what you pay.",
      proof: "See the quote. Accept or decline. Your choice.",
    },
  ],
};

// ====================================
// COMBINED POWER FRAMEWORKS
// Synthesized approaches for maximum impact
// ====================================

export const POWER_FRAMEWORKS = {
  // The Ultimate Ad Formula (Combining all experts)
  ultimateAdFormula: {
    components: [
      { phase: "HOOK", source: "Justin Welsh", action: "Pattern interrupt + curiosity gap" },
      { phase: "WHY", source: "Simon Sinek", action: "Connect with purpose/belief" },
      { phase: "STORY", source: "Russell Brunson", action: "Epiphany bridge moment" },
      { phase: "CATEGORY", source: "Nicholas Cole", action: "Position as new category leader" },
      { phase: "PROOF", source: "Nicholas Cole", action: "Specific numbers and mechanisms" },
      { phase: "OFFER", source: "Russell Brunson", action: "Clear value + urgency + risk reversal" },
    ],
    locksafeExample: {
      hook: "My mother was quoted £90. She paid £380. No proof. No recourse.",
      why: "We believe vulnerable people shouldn't be exploited.",
      story: "That moment changed everything. We built what the industry wouldn't.",
      category: "The UK's first anti-fraud locksmith platform.",
      proof: "2,500+ jobs protected. £0 scam losses. Legal documentation on every job.",
      offer: "Get protected emergency help in 15 min. Automatic refund guarantee. Request now →",
    },
  },

  // Emotional Escalation Ladder
  emotionalLadder: {
    description: "Move reader through emotional states to action",
    stages: [
      { emotion: "Recognition", copy: "You've heard the stories. £50 quotes becoming £300." },
      { emotion: "Fear", copy: "It happens more than you think. And when it does, it's your word against theirs." },
      { emotion: "Hope", copy: "But what if every job created legal proof?" },
      { emotion: "Trust", copy: "GPS tracking. Photos. Quotes you approve. Digital signatures. PDF reports." },
      { emotion: "Confidence", copy: "2,500+ protected jobs. £0 scam losses. 100% dispute resolution." },
      { emotion: "Action", copy: "Get protected help now. Automatic refund guarantee." },
    ],
  },

  // The "Problem Stack" (Nicholas Cole + Russell Brunson)
  problemStack: {
    description: "Stack multiple problems to make solution feel essential",
    problems: [
      "Locked out at night? Every locksmith looks the same online.",
      "Quoted one price, charged another? No way to prove it.",
      "Needed fast help? Got a cowboy instead.",
      "Complained afterward? Your word against theirs.",
    ],
    pivot: "There's now a platform built specifically for this.",
    solution: "LockSafe UK: Legal documentation. Transparent quotes. Automatic refunds.",
  },

  // The "Future Pacing" Close (Brunson technique)
  futurePacing: {
    description: "Help reader visualize success",
    formula: "Imagine [positive scenario]. That's what [product] gives you.",
    examples: [
      "Imagine getting locked out and NOT worrying about being scammed. That's LockSafe.",
      "Imagine having a PDF proving exactly what happened, what was quoted, what you agreed to. That's every LockSafe job.",
      "Imagine automatic refunds if they don't show up. No calls. No disputes. Just your money back.",
    ],
  },
};

// ====================================
// AD COPY TEMPLATES
// Ready-to-use templates for different scenarios
// ====================================

export const AD_COPY_TEMPLATES = {
  // Emergency (Urgency + Protection)
  emergency: [
    {
      angle: "Speed + Protection",
      primaryText: "Locked out? Don't panic. Don't overpay.\n\nLockSafe UK connects you with verified locksmiths in 15 minutes - but here's what makes us different: every job creates legal proof.\n\nGPS arrival. Itemised quote you approve. Digital signature. PDF report.\n\nYour word is never against theirs again.",
      headline: "Emergency Help. Built-In Protection.",
      callToAction: "GET_QUOTE",
    },
    {
      angle: "Anti-Scam Hook",
      primaryText: "Before you call a locksmith, read this:\n\nWe built LockSafe UK after scam locksmiths charged my mother £380 for a £90 job. No proof. No recourse.\n\nNow every job creates legal documentation. GPS. Photos. Quotes you approve. PDF reports.\n\nGet help fast AND stay protected.",
      headline: "15 Min Response. Full Protection.",
      callToAction: "GET_QUOTE",
    },
  ],

  // Trust/Anti-Fraud (Fear → Solution)
  trust: [
    {
      angle: "Category Leader",
      primaryText: "UK's first anti-fraud locksmith platform. Here's why it matters:\n\n✓ See the quote BEFORE work starts\n✓ Accept or decline (no pressure)\n✓ GPS tracking proves arrival\n✓ PDF report of entire job\n✓ Automatic refund if they don't show\n\nYour word is never against theirs again.",
      headline: "The Platform That Protects You",
      callToAction: "LEARN_MORE",
    },
    {
      angle: "Problem Stack",
      primaryText: "Heard the horror stories?\n\n£50 quotes becoming £300.\nCowboy locksmiths damaging locks.\n'It's your word against mine.'\n\nThere's now a platform built to prevent this.\n\nLockSafe UK creates legal proof for every job: GPS, photos, approved quotes, digital signatures.\n\n2,500+ protected jobs. £0 scam losses.",
      headline: "Stop Locksmith Scams. Legal Proof.",
      callToAction: "LEARN_MORE",
    },
  ],

  // Control/Empowerment
  control: [
    {
      angle: "Customer Choice",
      primaryText: "Finally, a locksmith service where YOU're in control:\n\n→ YOU choose your locksmith (compare fee, ETA, reviews)\n→ YOU see the quote before work starts\n→ YOU decide to accept or decline\n→ YOU sign digitally to confirm\n\nDecline the quote? Pay only the £25-49 assessment fee.\n\nNo pressure. No surprises. Just protection.",
      headline: "Your Job. Your Choice. Your Protection.",
      callToAction: "GET_QUOTE",
    },
  ],

  // Benefit/Value Proposition
  benefit: [
    {
      angle: "What You Get",
      primaryText: "What if calling a locksmith was actually... safe?\n\n✓ 15-min average response\n✓ Verified & DBS-checked locksmiths\n✓ See quote BEFORE work starts\n✓ Legal documentation on every job\n✓ Automatic refund if they don't arrive\n\nOh, and it's 100% free for customers.\n\nThis is what we built. This is LockSafe UK.",
      headline: "Fast. Protected. Free for Customers.",
      callToAction: "GET_QUOTE",
    },
  ],

  // Story-Led (Founder Story)
  story: [
    {
      angle: "Origin Story",
      primaryText: "3 years ago, my 78-year-old mother was charged £380 for a job that should have cost £90.\n\nWhen she complained? 'It's your word against mine.'\n\nNo proof. No recourse. Just a vulnerable woman taken advantage of.\n\nThat's when we built LockSafe UK. The platform where every job creates legal proof.\n\nNever again.",
      headline: "Built Because We Were Tired of Scam Stories.",
      callToAction: "LEARN_MORE",
    },
  ],

  // Why-Led (Simon Sinek style)
  whyLed: [
    {
      angle: "Purpose-Driven",
      primaryText: "We believe being locked out shouldn't mean being ripped off.\n\nWe believe vulnerable people shouldn't be exploited.\n\nWe believe your word should never be 'against theirs.'\n\nThat's why we built LockSafe UK. The platform where every locksmith job creates legal documentation.\n\nGPS. Photos. Approved quotes. Signatures. PDF proof.\n\nProtection that's automatic, not optional.",
      headline: "We Believe You Deserve Protection.",
      callToAction: "LEARN_MORE",
    },
  ],
};

// ====================================
// HEADLINE POWER VARIATIONS
// High-impact headlines organized by angle
// ====================================

export const POWER_HEADLINES = {
  urgency: [
    "Locked Out? Protected Help in 15 Minutes.",
    "Don't Just Find a Locksmith. Find a Protected One.",
    "Emergency Locksmith + Legal Documentation.",
    "Every Minute Matters. So Does Your Protection.",
  ],
  trust: [
    "UK's First Anti-Fraud Locksmith Platform",
    "Your Word Is Never Against Theirs Again",
    "The Platform Built to Stop Locksmith Scams",
    "Legal Proof on Every Job. Zero Scam Losses.",
  ],
  control: [
    "See the Quote First. Then Decide.",
    "Your Locksmith. Your Choice. Your Protection.",
    "Accept or Decline. No Pressure. Ever.",
    "Finally, You're in Control.",
  ],
  benefit: [
    "Fast Response. Full Documentation. Free for Customers.",
    "15 Min Response + Legal Protection + Refund Guarantee",
    "What If Hiring a Locksmith Was Actually Safe?",
    "The Locksmith Service That Actually Protects You",
  ],
  fear: [
    "The £50 Quote That Became £380",
    "How to Avoid the 'Cowboy Locksmith' Trap",
    "Stop. Before You Google 'Locksmith Near Me'...",
    "70% of Locksmith Applicants Rejected. Here's Why.",
  ],
  curiosity: [
    "What the Locksmith Industry Doesn't Want You to Know",
    "The One Thing That Prevents 99% of Locksmith Scams",
    "Why Some Locksmiths Don't Want You Using This Platform",
    "This Changes Everything About Calling a Locksmith",
  ],
};

// ====================================
// CALL TO ACTION VARIATIONS
// CTAs organized by urgency and goal
// ====================================

export const POWER_CTAS = {
  emergency: [
    { text: "Get Help Now", subtext: "Protected locksmith in 15 min" },
    { text: "Find Protected Locksmith", subtext: "GPS tracked, documented, guaranteed" },
    { text: "Request Emergency Help", subtext: "Verified locksmiths only" },
  ],
  consideration: [
    { text: "See How It Works", subtext: "2 min to understand" },
    { text: "Learn More", subtext: "Protection explained" },
    { text: "Compare Locksmiths", subtext: "Verified, rated, documented" },
  ],
  conversion: [
    { text: "Get Protected Quotes", subtext: "See prices before you commit" },
    { text: "Request Locksmith", subtext: "100% free for customers" },
    { text: "Start Protected Request", subtext: "Automatic refund guarantee" },
  ],
};

// ====================================
// EXPORT ALL FRAMEWORKS
// ====================================

export const COPYWRITING_FRAMEWORKS = {
  justinWelsh: JUSTIN_WELSH_HOOKS,
  russellBrunson: RUSSELL_BRUNSON_FRAMEWORKS,
  nicholasCole: NICHOLAS_COLE_FRAMEWORKS,
  simonSinek: SIMON_SINEK_FRAMEWORKS,
  power: POWER_FRAMEWORKS,
  templates: AD_COPY_TEMPLATES,
  headlines: POWER_HEADLINES,
  ctas: POWER_CTAS,
};

export default COPYWRITING_FRAMEWORKS;
