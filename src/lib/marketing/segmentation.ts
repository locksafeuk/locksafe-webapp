// User segment types
export type UserSegment =
  | "emergency"
  | "price_shopper"
  | "researcher"
  | "returning"
  | "landlord"
  | "locksmith_prospect"
  | "post_service";

// Segment detection rules
export interface SegmentRules {
  segment: UserSegment;
  conditions: SegmentCondition[];
  minScore: number;
}

export interface SegmentCondition {
  type: string;
  value: unknown;
  points: number;
}

// Scoring rules for segments
export const segmentRules: SegmentRules[] = [
  {
    segment: "emergency",
    minScore: 2,
    conditions: [
      { type: "timeOnSite", value: 30, points: 2 }, // Less than 30 seconds
      { type: "deviceType", value: "mobile", points: 1 },
      { type: "timeOfDay", value: "evening_or_night", points: 1 },
      { type: "landingPage", value: "/request", points: 2 },
      { type: "ctaClick", value: "emergency", points: 3 },
    ],
  },
  {
    segment: "price_shopper",
    minScore: 2,
    conditions: [
      { type: "faqClicks", value: 2, points: 1 }, // More than 2 FAQ clicks
      { type: "pricingHover", value: 5, points: 1 }, // Hover on pricing > 5 seconds
      { type: "visitCount", value: 2, points: 1 }, // More than 1 visit
      { type: "scrollToPricing", value: true, points: 1 },
    ],
  },
  {
    segment: "researcher",
    minScore: 3,
    conditions: [
      { type: "testimonialViews", value: 2, points: 1 },
      { type: "scrollDepth", value: 80, points: 1 },
      { type: "timeOnSite", value: 120, points: 1 }, // More than 2 minutes
      { type: "pageViews", value: 3, points: 1 },
    ],
  },
  {
    segment: "returning",
    minScore: 1,
    conditions: [{ type: "visitCount", value: 2, points: 1 }],
  },
  {
    segment: "landlord",
    minScore: 2,
    conditions: [
      { type: "commercialPageView", value: true, points: 2 },
      { type: "multiPropertyInterest", value: true, points: 2 },
    ],
  },
  {
    segment: "locksmith_prospect",
    minScore: 2,
    conditions: [
      { type: "locksmithPageView", value: true, points: 2 },
      { type: "recruitmentClick", value: true, points: 3 },
    ],
  },
];

// Engagement scoring
export const engagementScoring: Record<string, number> = {
  page_view: 1,
  time_on_page_30s: 2,
  scroll_depth_50: 3,
  testimonial_interaction: 5,
  faq_interaction: 5,
  cta_hover: 3,
  form_start: 10,
  chat_open: 10,
  return_visit: 5,
  email_open: 3,
  email_click: 5,
};

// Intent scoring
export const intentScoring: Record<string, number> = {
  emergency_page_visit: 20,
  form_progress_50: 15,
  phone_reveal: 25,
  request_quote_button: 30,
  near_me_search: 15,
  pricing_page_2_views: 10,
  chat_initiated: 25,
  mobile_evening: 10,
};

// Calculate segment scores from user behavior
export function calculateSegmentScores(behavior: {
  timeOnSite: number;
  deviceType: string;
  timeOfDay: string;
  landingPage: string;
  pageViews: string[];
  events: { type: string; element?: string; data?: Record<string, unknown> }[];
  visitCount: number;
  scrollDepth: number;
}): UserSegment[] {
  const segments: UserSegment[] = [];

  for (const rule of segmentRules) {
    let score = 0;

    for (const condition of rule.conditions) {
      switch (condition.type) {
        case "timeOnSite":
          if (
            rule.segment === "emergency" &&
            behavior.timeOnSite < (condition.value as number)
          ) {
            score += condition.points;
          } else if (
            rule.segment === "researcher" &&
            behavior.timeOnSite > (condition.value as number)
          ) {
            score += condition.points;
          }
          break;

        case "deviceType":
          if (behavior.deviceType === condition.value) {
            score += condition.points;
          }
          break;

        case "timeOfDay":
          if (behavior.timeOfDay === condition.value) {
            score += condition.points;
          }
          break;

        case "landingPage":
          if (behavior.landingPage === condition.value) {
            score += condition.points;
          }
          break;

        case "visitCount":
          if (behavior.visitCount >= (condition.value as number)) {
            score += condition.points;
          }
          break;

        case "scrollDepth":
          if (behavior.scrollDepth >= (condition.value as number)) {
            score += condition.points;
          }
          break;

        case "pageViews":
          if (behavior.pageViews.length >= (condition.value as number)) {
            score += condition.points;
          }
          break;

        case "faqClicks":
          const faqClicks = behavior.events.filter(
            (e) => e.type === "click" && e.element?.includes("faq")
          ).length;
          if (faqClicks >= (condition.value as number)) {
            score += condition.points;
          }
          break;

        case "testimonialViews":
          const testimonialViews = behavior.events.filter(
            (e) =>
              e.type === "view" &&
              e.element?.includes("testimonial")
          ).length;
          if (testimonialViews >= (condition.value as number)) {
            score += condition.points;
          }
          break;

        case "commercialPageView":
          if (
            behavior.pageViews.some(
              (p) => p.includes("commercial") || p.includes("business")
            )
          ) {
            score += condition.points;
          }
          break;

        case "locksmithPageView":
          if (
            behavior.pageViews.some(
              (p) =>
                p.includes("locksmith-signup") ||
                p.includes("become-locksmith")
            )
          ) {
            score += condition.points;
          }
          break;
      }
    }

    if (score >= rule.minScore) {
      segments.push(rule.segment);
    }
  }

  return segments;
}

// Get time of day category
export function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 18 || hour < 6) return "evening_or_night";
  if (hour >= 6 && hour < 12) return "morning";
  return "afternoon";
}

// Calculate engagement score from events
export function calculateEngagementScore(
  events: { type: string; element?: string }[]
): number {
  let score = 0;

  for (const event of events) {
    const key = `${event.type}_${event.element || ""}`.toLowerCase();

    for (const [pattern, points] of Object.entries(engagementScoring)) {
      if (key.includes(pattern) || event.type === pattern) {
        score += points;
      }
    }
  }

  return Math.min(score, 100);
}

// Calculate intent score from events
export function calculateIntentScore(
  events: { type: string; element?: string; data?: Record<string, unknown> }[],
  deviceType: string,
  timeOfDay: string
): number {
  let score = 0;

  for (const event of events) {
    const key = event.type.toLowerCase();

    for (const [pattern, points] of Object.entries(intentScoring)) {
      if (key.includes(pattern.replace("_", ""))) {
        score += points;
      }
    }
  }

  // Bonus for mobile + evening
  if (deviceType === "mobile" && timeOfDay === "evening_or_night") {
    score += intentScoring.mobile_evening;
  }

  return Math.min(score, 100);
}
