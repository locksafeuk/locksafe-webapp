import type { UserSegment } from "./segmentation";

// Modal types
export type ModalType =
  | "welcome_survey"
  | "exit_intent"
  | "price_guarantee"
  | "trust_builder"
  | "form_abandonment"
  | "special_offer"
  | "lead_magnet"
  | "business_inquiry"
  | "post_service"
  | "locksmith_recruitment";

// Trigger definition
export interface ModalTrigger {
  id: string;
  modalType: ModalType;
  description: string;
  conditions: TriggerCondition[];
  priority: number;
  showOnce: boolean;
  cooldownHours: number;
  segments?: UserSegment[];
  funnelStages?: string[];
}

// Trigger condition types
export interface TriggerCondition {
  type:
    | "time_on_page"
    | "scroll_depth"
    | "exit_intent"
    | "visit_count"
    | "page_path"
    | "idle_time"
    | "element_hover"
    | "form_abandonment"
    | "segment"
    | "funnel_stage"
    | "first_visit"
    | "returning_visitor"
    | "completed_job";
  operator: "gt" | "lt" | "eq" | "contains" | "not_contains" | "in";
  value: unknown;
}

// Default triggers - Updated with longer cooldowns and delays
export const defaultTriggers: ModalTrigger[] = [
  {
    id: "T010",
    modalType: "welcome_survey",
    description: "Segment visitors immediately for personalized experience",
    conditions: [
      { type: "first_visit", operator: "eq", value: true },
      { type: "time_on_page", operator: "gt", value: 8 }, // After 8 seconds (increased from 3)
    ],
    priority: 100,
    showOnce: true,
    cooldownHours: 336, // 14 days (increased from 7)
  },
  {
    id: "T001",
    modalType: "exit_intent",
    description: "Capture leaving visitors with lead magnet",
    conditions: [{ type: "exit_intent", operator: "eq", value: true }],
    priority: 90,
    showOnce: false,
    cooldownHours: 48, // Increased from 24
    funnelStages: ["visitor", "lead"],
  },
  {
    id: "T002",
    modalType: "price_guarantee",
    description: "Address price objections",
    conditions: [
      { type: "time_on_page", operator: "gt", value: 45 }, // Increased from 30
      { type: "segment", operator: "in", value: ["price_shopper"] },
    ],
    priority: 70,
    showOnce: true,
    cooldownHours: 72, // Increased from 48
    segments: ["price_shopper"],
  },
  {
    id: "T003",
    modalType: "trust_builder",
    description: "Reinforce trust for researchers",
    conditions: [
      { type: "scroll_depth", operator: "gt", value: 50 },
      { type: "time_on_page", operator: "gt", value: 60 }, // Added time requirement
      { type: "segment", operator: "in", value: ["researcher"] },
    ],
    priority: 60,
    showOnce: true,
    cooldownHours: 72, // Increased from 48
    segments: ["researcher"],
  },
  {
    id: "T005",
    modalType: "special_offer",
    description: "Convert returning visitors",
    conditions: [
      { type: "returning_visitor", operator: "eq", value: true },
      { type: "visit_count", operator: "gt", value: 2 },
      { type: "time_on_page", operator: "gt", value: 30 }, // Added time requirement
    ],
    priority: 80,
    showOnce: true,
    cooldownHours: 96, // 4 days (increased from 72)
    segments: ["returning"],
  },
  {
    id: "T006",
    modalType: "lead_magnet",
    description: "Capture engaged visitors",
    conditions: [
      { type: "scroll_depth", operator: "gt", value: 80 },
      { type: "time_on_page", operator: "gt", value: 90 }, // Increased from 60
    ],
    priority: 50,
    showOnce: true,
    cooldownHours: 72, // Increased from 48
    funnelStages: ["visitor"],
  },
  {
    id: "T008",
    modalType: "business_inquiry",
    description: "Segment B2B leads",
    conditions: [
      {
        type: "page_path",
        operator: "contains",
        value: ["commercial", "business", "landlord"],
      },
    ],
    priority: 75,
    showOnce: true,
    cooldownHours: 168,
    segments: ["landlord"],
  },
  {
    id: "T012",
    modalType: "locksmith_recruitment",
    description: "Capture locksmith leads",
    conditions: [
      {
        type: "page_path",
        operator: "contains",
        value: ["locksmith-signup", "become-locksmith"],
      },
    ],
    priority: 85,
    showOnce: true,
    cooldownHours: 168,
    segments: ["locksmith_prospect"],
  },
];

// Check if a condition is met
export function checkCondition(
  condition: TriggerCondition,
  context: {
    timeOnPage: number;
    scrollDepth: number;
    exitIntent: boolean;
    visitCount: number;
    pagePath: string;
    idleTime: number;
    segment: string[];
    funnelStage: string;
    isFirstVisit: boolean;
    formAbandoned: boolean;
  }
): boolean {
  switch (condition.type) {
    case "time_on_page":
      return compareValue(context.timeOnPage, condition.operator, condition.value as number);

    case "scroll_depth":
      return compareValue(context.scrollDepth, condition.operator, condition.value as number);

    case "exit_intent":
      return context.exitIntent === condition.value;

    case "visit_count":
      return compareValue(context.visitCount, condition.operator, condition.value as number);

    case "page_path":
      if (condition.operator === "contains") {
        const paths = condition.value as string[];
        return paths.some((p) => context.pagePath.includes(p));
      }
      return context.pagePath === condition.value;

    case "idle_time":
      return compareValue(context.idleTime, condition.operator, condition.value as number);

    case "segment":
      if (condition.operator === "in") {
        const segments = condition.value as string[];
        return segments.some((s) => context.segment.includes(s));
      }
      return false;

    case "funnel_stage":
      return context.funnelStage === condition.value;

    case "first_visit":
      return context.isFirstVisit === condition.value;

    case "returning_visitor":
      return !context.isFirstVisit === condition.value;

    case "form_abandonment":
      return context.formAbandoned === condition.value;

    default:
      return false;
  }
}

function compareValue(
  actual: number,
  operator: string,
  expected: number
): boolean {
  switch (operator) {
    case "gt":
      return actual > expected;
    case "lt":
      return actual < expected;
    case "eq":
      return actual === expected;
    default:
      return false;
  }
}

// Get triggered modals based on context
export function getTriggeredModals(
  context: {
    timeOnPage: number;
    scrollDepth: number;
    exitIntent: boolean;
    visitCount: number;
    pagePath: string;
    idleTime: number;
    segment: string[];
    funnelStage: string;
    isFirstVisit: boolean;
    formAbandoned: boolean;
  },
  shownModals: string[],
  dismissedModals: string[]
): ModalTrigger[] {
  const triggered: ModalTrigger[] = [];

  for (const trigger of defaultTriggers) {
    // Skip if already shown and showOnce is true
    if (trigger.showOnce && shownModals.includes(trigger.modalType)) {
      continue;
    }

    // Check all conditions
    const allConditionsMet = trigger.conditions.every((condition) =>
      checkCondition(condition, context)
    );

    if (allConditionsMet) {
      triggered.push(trigger);
    }
  }

  // Sort by priority (highest first)
  return triggered.sort((a, b) => b.priority - a.priority);
}
