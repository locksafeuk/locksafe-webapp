/**
 * LockSafe UK Business Context
 *
 * ACCURATE business information for the AI system to use when generating
 * ad copy, audience suggestions, and marketing strategies.
 *
 * LockSafe UK is the UK's FIRST ANTI-FRAUD locksmith platform.
 * NOT just a booking platform - it's a protection system.
 */

export const BUSINESS_CONTEXT = {
  // Company Identity
  company: {
    name: "LockSafe UK",
    tagline: "UK's First Anti-Fraud Locksmith Platform",
    categoryStatement: "The Only Platform That Prevents Price Scams",
    description: `LockSafe UK is the UK's first anti-fraud locksmith platform. We connect customers with verified locksmiths, but our real innovation is the legally-binding digital paper trail that protects everyone from scams and disputes.

Every job creates: GPS tracking, timestamped photos, digital signatures, and instant PDF reports. Your word is never against theirs again.`,
    founderStory: `"My 78-year-old mother was charged £380 for a job that should have cost £90. The locksmith knew she was vulnerable, alone, and desperate. When she complained, it was her word against his. That's when we decided: never again." - James Thompson, Founder & CEO`,
    website: "https://locksafe.co.uk",
    location: "United Kingdom",
  },

  // What Makes Us Different (CRITICAL for ads)
  killerDifferentiators: [
    {
      headline: "Legally-Binding Digital Paper Trail",
      description: "No competitor offers this. Every job creates a complete, timestamped, legally-admissible record.",
      proof: ["GPS coordinates at arrival/completion", "Before/during/after photos with metadata", "Digital signature with confirmations", "Instant PDF report - proof forever"],
    },
    {
      headline: "Automatic Refund Guarantee",
      description: "If locksmith doesn't arrive within agreed ETA + 30 min grace period, you get automatic full refund.",
      proof: ["No questions asked", "Locksmith's account debited automatically", "Money back in your account instantly"],
    },
    {
      headline: "YOU See the Quote BEFORE Work Starts",
      description: "Accept or decline the work quote. Decline = you only pay the assessment fee. No pressure, no hidden fees.",
      proof: ["Itemised quote with parts and labour", "Your choice to proceed or not", "Assessment fee is all you lose if you decline"],
    },
  ],

  // Business Model (Important for understanding pricing)
  businessModel: {
    customerCost: "FREE - Customers never pay LockSafe anything",
    howItWorks: "Customers pay locksmiths directly. LockSafe takes 15% commission from locksmiths.",
    assessmentFee: {
      range: "£25-£49",
      description: "Locksmiths set their own assessment fee. This covers travel and on-site diagnosis.",
      keyPoint: "You pay this to CONFIRM the booking. If you decline the work quote, this is ALL you pay.",
    },
    averageJobValue: { min: 80, max: 250, currency: "GBP" },
  },

  // The How It Works Process (9 Steps)
  howItWorks: [
    { step: 1, title: "Submit Request", description: "Enter location, describe problem. Free, no commitment.", customerControl: false },
    { step: 2, title: "YOU Choose Your Locksmith", description: "Compare fee, ETA, rating, reviews. Pick who YOU want.", customerControl: true },
    { step: 3, title: "Arrival Confirmed", description: "Locksmith checks in with GPS and timestamp verification.", customerControl: false },
    { step: 4, title: "Real Diagnostic", description: "Locksmith inspects, documents lock type, defect, required parts.", customerControl: false },
    { step: 5, title: "Instant Quote", description: "Detailed quote on your phone with complete cost breakdown.", customerControl: false },
    { step: 6, title: "YOU Decide: Accept or Decline", description: "Accept to proceed, or decline and only pay assessment fee.", customerControl: true },
    { step: 7, title: "Work Execution", description: "START/FINISH timestamps, final photos. All recorded.", customerControl: false },
    { step: 8, title: "YOU Confirm & Sign", description: "Digital signature confirms work, price, satisfaction.", customerControl: true },
    { step: 9, title: "Legal PDF Report", description: "Complete timeline, GPS, photos, signature. Your anti-fraud shield.", customerControl: false },
  ],

  // Dual Protection System
  dualProtection: {
    customerProtection: {
      title: "Customer Protection",
      subtitle: "Your money is always safe",
      benefits: [
        { bold: "Automatic refund", text: "if locksmith doesn't arrive on time" },
        { bold: "See quote before work", text: "- decline and only pay assessment fee" },
        { bold: "Digital signature required", text: "- locksmith can't claim you approved work you didn't" },
        { bold: "PDF evidence", text: "- complete proof for any dispute" },
      ],
    },
    locksmithProtection: {
      title: "Locksmith Protection",
      subtitle: "Fair payment, guaranteed",
      benefits: [
        { bold: "Verified customers", text: "- card on file before you travel" },
        { bold: "Guaranteed payment", text: "- funds processed through secure platform" },
        { bold: "GPS proof of arrival", text: "- customer can't claim you never showed up" },
        { bold: "Digital sign-off", text: "- documented customer approval of work" },
      ],
    },
  },

  // Problem Types We Handle
  problemTypes: [
    { id: "lockout", label: "Locked Out", description: "Can't get into your property", emergency: true },
    { id: "broken", label: "Broken Lock", description: "Lock is damaged or not working", emergency: false },
    { id: "key-stuck", label: "Key Stuck", description: "Key is jammed in the lock", emergency: true },
    { id: "lost-keys", label: "Lost Keys", description: "Need locks changed", emergency: false },
    { id: "burglary", label: "After Burglary", description: "Emergency security needed", emergency: true },
    { id: "security-upgrade", label: "Security Upgrade", description: "Want better locks", emergency: false },
  ],

  // Property Types Served
  propertyTypes: ["House", "Flat/Apartment", "Commercial/Business", "Vehicle"],

  // Coverage & Response
  coverage: {
    area: "UK-Wide",
    responseTime: "15-30 minutes average",
    availability: "24/7, 365 days a year",
  },

  // Trust & Verification
  trustSignals: {
    locksmithVerification: [
      "DBS background check",
      "Proof of qualifications",
      "Insurance verification",
      "Reference checks",
      "Continuous rating monitoring",
    ],
    rejectionRate: "70% of locksmith applicants rejected",
    stats: {
      jobsProtected: "2,500+",
      scamLossesReported: "£0",
      disputeResolutionRate: "100%",
      customerRating: "4.9/5",
    },
  },

  // Target Audiences for Ads
  targetAudiences: [
    {
      id: "emergency-lockout",
      name: "Emergency Lockout Victims",
      description: "People currently locked out - high urgency, need help NOW",
      demographics: { ageMin: 18, ageMax: 65, genders: ["all"] },
      mindset: "Stressed, desperate, worried about being scammed",
      painPoints: [
        "Locked out at inconvenient time",
        "Worried about being overcharged",
        "Don't know who to trust",
        "Previous bad locksmith experience",
      ],
      whatTheyWant: ["Fast response", "Fair price", "Trustworthy person", "No nasty surprises"],
      bestMessaging: "Speed + protection. 'Help in 15 min, but PROTECTED help.'",
      emotionalTrigger: "urgency + trust",
    },
    {
      id: "scam-aware",
      name: "Scam-Aware Customers",
      description: "People who've heard horror stories or been scammed before",
      demographics: { ageMin: 25, ageMax: 60, genders: ["all"] },
      mindset: "Cautious, skeptical, wants proof and protection",
      painPoints: [
        "Heard about £50 quotes becoming £300",
        "Been overcharged before",
        "Worried about vulnerable family members",
        "No way to prove what really happened",
      ],
      whatTheyWant: ["Written quotes", "Proof system", "Recourse if things go wrong", "Protection"],
      bestMessaging: "Lead with anti-fraud. 'The ONLY platform that prevents price scams.'",
      emotionalTrigger: "fear of scams + desire for protection",
    },
    {
      id: "security-upgraders",
      name: "Home Security Upgraders",
      description: "Homeowners wanting to improve security (post-burglary, new home, peace of mind)",
      demographics: { ageMin: 30, ageMax: 65, genders: ["all"] },
      mindset: "Research-oriented, comparing options, want quality",
      painPoints: [
        "Don't know fair prices for lock work",
        "Worried about cowboy traders",
        "Want proper documentation for insurance",
        "Previous contractor let them down",
      ],
      whatTheyWant: ["Transparent pricing", "Qualified professional", "Documentation", "Guarantee"],
      bestMessaging: "Transparency + professionalism. 'Verified experts, itemised quotes, full documentation.'",
      emotionalTrigger: "peace of mind + trust",
    },
    {
      id: "new-movers",
      name: "New Homeowners / Movers",
      description: "Just moved, want to change locks for security",
      demographics: { ageMin: 25, ageMax: 50, genders: ["all"] },
      mindset: "Fresh start, security-conscious, busy with move",
      painPoints: [
        "Unknown who has keys to the property",
        "Don't know local tradespeople",
        "Busy with moving, don't want hassle",
        "Need it done properly first time",
      ],
      whatTheyWant: ["Quick and reliable service", "Fair price", "Professional work", "No stress"],
      bestMessaging: "New home, new security. 'Verified locksmiths, transparent quotes, done right.'",
      emotionalTrigger: "fresh start + security",
    },
    {
      id: "landlords",
      name: "Landlords & Property Managers",
      description: "Managing multiple properties, need reliable locksmith on call",
      demographics: { ageMin: 30, ageMax: 60, genders: ["all"] },
      mindset: "Business-minded, need documentation, value reliability",
      painPoints: [
        "Tenant lockouts at all hours",
        "Need quick turnaround between tenants",
        "Require proper invoices and documentation",
        "Previous bad experiences with unreliable trades",
      ],
      whatTheyWant: ["Fast response", "Proper documentation", "Consistent pricing", "Reliable service"],
      bestMessaging: "Business-grade service. 'PDF documentation, verified pros, 24/7 availability.'",
      emotionalTrigger: "reliability + professionalism",
    },
  ],

  // Emotional Triggers & Copy Angles
  emotionalAngles: {
    urgency: {
      headlines: [
        "Locked Out Right Now?",
        "Stranded? Help in 15 Minutes",
        "Emergency Locksmith - We're On Our Way",
        "Don't Wait Outside Any Longer",
      ],
      hooks: [
        "Locksmith arriving in minutes, not hours",
        "24/7 emergency response across the UK",
        "Average 15-minute response time",
      ],
    },
    fear: {
      headlines: [
        "Don't Get Scammed by a Cowboy Locksmith",
        "The £50 Quote That Became £300",
        "Why Your Next Locksmith Could Overcharge You",
        "Protect Yourself from Locksmith Fraud",
      ],
      hooks: [
        "We built this because we were tired of scams",
        "Your word against theirs? Never again.",
        "See the quote BEFORE work starts - accept or decline",
      ],
    },
    trust: {
      headlines: [
        "UK's First Anti-Fraud Locksmith Platform",
        "Every Job Creates Legal Proof",
        "Verified, Insured, DBS-Checked Locksmiths",
        "The Platform That Protects You",
      ],
      hooks: [
        "GPS tracking, photos, digital signature, PDF report",
        "Automatic refund if locksmith doesn't arrive",
        "70% of locksmith applicants rejected",
      ],
    },
    control: {
      headlines: [
        "YOU Choose Your Locksmith",
        "See the Quote. Accept or Decline.",
        "Your Job, Your Choice, Your Protection",
        "Finally, a Locksmith Service Where YOU're in Control",
      ],
      hooks: [
        "Compare locksmiths by fee, ETA, and reviews",
        "Decline the work quote? Pay only the assessment fee",
        "Digital signature = YOUR approval required",
      ],
    },
    benefit: {
      headlines: [
        "Transparent Pricing, Legal Documentation, Your Choice",
        "Fast Response + Full Protection",
        "The Locksmith Service That Actually Protects You",
        "15-Min Response, Full Documentation, Fair Prices",
      ],
      hooks: [
        "100% free for customers",
        "Instant PDF report for every job",
        "Automatic refund guarantee",
      ],
    },
  },

  // FAQs (for addressing objections in ads)
  commonObjections: {
    "Is it really free?": "Yes, 100% free for customers. Locksmiths pay us a small commission, not you.",
    "What if I don't like the quote?": "Decline it. You've only paid the assessment fee (£25-49). No pressure.",
    "What if the locksmith doesn't show?": "Automatic full refund. No questions asked. Locksmith's account debited.",
    "How do I know they're legitimate?": "DBS checked, insured, qualified. We reject 70% of applicants.",
    "What's the assessment fee for?": "Covers locksmith's travel and diagnosis. Paid upfront to confirm booking.",
  },

  // Brand Voice Guidelines
  brandVoice: {
    tone: "Direct, protective, empowering, no-nonsense",
    personality: ["Trustworthy guardian", "Straight-talking", "Customer champion", "Anti-fraud fighter"],
    keyMessages: [
      "UK's first anti-fraud locksmith platform",
      "Your word is never against theirs again",
      "See the quote BEFORE work starts",
      "Automatic refund if locksmith doesn't arrive",
      "Every job creates a legal paper trail",
    ],
    avoid: [
      "Generic 'best locksmith' claims",
      "Vague trust statements without proof",
      "Complicated pricing explanations",
      "Fear-mongering without offering solution",
    ],
    emphasize: [
      "Anti-fraud protection",
      "Customer control and choice",
      "Legal documentation",
      "Transparency",
      "Verified professionals",
    ],
  },

  // Social Proof
  socialProof: {
    stats: [
      "2,500+ jobs protected",
      "£0 scam losses reported",
      "100% dispute resolution rate",
      "4.9/5 average rating",
      "15 min average response",
    ],
    testimonialThemes: [
      "Got a fair price when other quotes were ridiculous",
      "The PDF report saved me in a dispute",
      "Finally a locksmith service I can trust",
      "Arrived fast AND the price was exactly as quoted",
    ],
  },

  // Call to Actions
  callToActions: {
    emergency: [
      { text: "Get Emergency Help", subtext: "Locksmith in 15 minutes" },
      { text: "Help Me Now", subtext: "24/7 protected service" },
    ],
    general: [
      { text: "Find a Verified Locksmith", subtext: "Compare prices and ETAs" },
      { text: "Get Protected Quotes", subtext: "See prices before you commit" },
    ],
    security: [
      { text: "Book Security Upgrade", subtext: "Verified experts, full documentation" },
      { text: "Get Quotes", subtext: "Compare verified locksmiths" },
    ],
  },

  // Seasonal Considerations
  seasonalFactors: [
    { season: "Winter", factor: "More lockouts (dark evenings, frozen locks)", bestAngles: ["emergency", "urgency"] },
    { season: "Summer", factor: "Holiday lockouts, securing homes before vacation", bestAngles: ["security", "trust"] },
    { season: "Moving Season (Spring/Autumn)", factor: "Lock changes for new homeowners", bestAngles: ["benefit", "control"] },
    { season: "Christmas/NYE", factor: "Emergency lockouts during holidays, offices closed", bestAngles: ["urgency", "trust"] },
    { season: "Post-burglary spikes", factor: "After local news of break-ins", bestAngles: ["fear", "trust"] },
  ],
} as const;

// ========================
// HELPER FUNCTIONS FOR AI
// ========================

/**
 * Get comprehensive business summary for AI prompts
 */
export function getBusinessSummary(): string {
  return `
LOCKSAFE UK - UK's First Anti-Fraud Locksmith Platform

WHAT WE ARE:
${BUSINESS_CONTEXT.company.description}

OUR KILLER DIFFERENTIATORS (no competitor has these):
${BUSINESS_CONTEXT.killerDifferentiators.map(d => `• ${d.headline}: ${d.description}`).join('\n')}

BUSINESS MODEL:
- FREE for customers (we take commission from locksmiths)
- Assessment fee: ${BUSINESS_CONTEXT.businessModel.assessmentFee.range} (set by locksmith, paid to confirm booking)
- Average job value: £${BUSINESS_CONTEXT.businessModel.averageJobValue.min}-${BUSINESS_CONTEXT.businessModel.averageJobValue.max}

DUAL PROTECTION SYSTEM:
FOR CUSTOMERS:
${BUSINESS_CONTEXT.dualProtection.customerProtection.benefits.map(b => `• ${b.bold} ${b.text}`).join('\n')}

FOR LOCKSMITHS:
${BUSINESS_CONTEXT.dualProtection.locksmithProtection.benefits.map(b => `• ${b.bold} ${b.text}`).join('\n')}

COVERAGE:
- ${BUSINESS_CONTEXT.coverage.area}
- ${BUSINESS_CONTEXT.coverage.responseTime} response
- ${BUSINESS_CONTEXT.coverage.availability}

TRUST STATS:
${BUSINESS_CONTEXT.socialProof.stats.map(s => `• ${s}`).join('\n')}

BRAND VOICE:
- Tone: ${BUSINESS_CONTEXT.brandVoice.tone}
- Key messages: ${BUSINESS_CONTEXT.brandVoice.keyMessages.join(' | ')}
- Avoid: ${BUSINESS_CONTEXT.brandVoice.avoid.join(', ')}

FOUNDER STORY:
${BUSINESS_CONTEXT.company.founderStory}
`.trim();
}

/**
 * Get audience-specific context for ad targeting
 */
export function getAudienceContext(audienceId?: string): string {
  if (audienceId) {
    const audience = BUSINESS_CONTEXT.targetAudiences.find(a => a.id === audienceId);
    if (audience) {
      return `
TARGET AUDIENCE: ${audience.name}
Description: ${audience.description}
Age: ${audience.demographics.ageMin}-${audience.demographics.ageMax}
Mindset: ${audience.mindset}

PAIN POINTS:
${audience.painPoints.map(p => `• ${p}`).join('\n')}

WHAT THEY WANT:
${audience.whatTheyWant.map(w => `• ${w}`).join('\n')}

BEST MESSAGING APPROACH:
${audience.bestMessaging}

EMOTIONAL TRIGGER: ${audience.emotionalTrigger}
`;
    }
  }

  return `
TARGET AUDIENCES OVERVIEW:
${BUSINESS_CONTEXT.targetAudiences.map(a => `
• ${a.name}: ${a.description}
  Pain Points: ${a.painPoints.join(', ')}
  Best Messaging: ${a.bestMessaging}
`).join('\n')}
`;
}

/**
 * Get emotional angle copy suggestions
 */
export function getEmotionalAngleCopy(angle: keyof typeof BUSINESS_CONTEXT.emotionalAngles): {
  headlines: readonly string[];
  hooks: readonly string[];
} {
  return BUSINESS_CONTEXT.emotionalAngles[angle];
}

/**
 * Get seasonal context
 */
export function getSeasonalContext(): string {
  const month = new Date().getMonth();
  let currentSeason = 'general';

  if (month >= 11 || month <= 1) currentSeason = 'Winter';
  else if (month >= 2 && month <= 4) currentSeason = 'Spring';
  else if (month >= 5 && month <= 7) currentSeason = 'Summer';
  else currentSeason = 'Autumn';

  const relevantFactors = BUSINESS_CONTEXT.seasonalFactors.filter(
    f => f.season.toLowerCase().includes(currentSeason.toLowerCase()) || f.season.includes('Season')
  );

  if (relevantFactors.length > 0) {
    return `
CURRENT SEASON: ${currentSeason}
${relevantFactors.map(f => `• ${f.season}: ${f.factor} (Best angles: ${f.bestAngles.join(', ')})`).join('\n')}
`;
  }

  return '';
}

/**
 * Get objection handlers for ad copy
 */
export function getObjectionHandlers(): string {
  return Object.entries(BUSINESS_CONTEXT.commonObjections)
    .map(([objection, response]) => `Q: "${objection}"\nA: ${response}`)
    .join('\n\n');
}

export type BusinessContext = typeof BUSINESS_CONTEXT;
