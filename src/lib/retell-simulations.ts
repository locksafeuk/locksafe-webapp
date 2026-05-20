export type SimulationScenario = {
  key: string;
  description: string;
  expected: {
    requiresEscalation: boolean;
    minNaturalness: number;
    mustCollect: string[];
  };
};

export const RETELL_SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    key: "emergency_lockout",
    description: "Late-night home lockout with stressed caller",
    expected: {
      requiresEscalation: false,
      minNaturalness: 3.5,
      mustCollect: ["name", "postcode", "phone", "email", "job_reference", "sms_link_sent"],
    },
  },
  {
    key: "noisy_caller",
    description: "Caller with heavy background noise and interruptions",
    expected: {
      requiresEscalation: false,
      minNaturalness: 3.2,
      mustCollect: ["postcode", "problem"],
    },
  },
  {
    key: "frustrated_dispute",
    description: "Aggressive caller disputing past invoice",
    expected: {
      requiresEscalation: true,
      minNaturalness: 3.0,
      mustCollect: ["name", "callback"],
    },
  },
  {
    key: "appointment_booking",
    description: "Caller wants to schedule a non-emergency lock service appointment",
    expected: {
      requiresEscalation: false,
      minNaturalness: 3.2,
      mustCollect: ["name", "postcode", "service", "preferred_slot", "email", "job_reference", "sms_link_sent"],
    },
  },
  {
    key: "price_objection",
    description: "Caller challenges quote and asks for cheaper alternatives",
    expected: {
      requiresEscalation: false,
      minNaturalness: 3.4,
      mustCollect: ["name", "postcode", "problem", "email", "job_reference", "sms_link_sent"],
    },
  },
  {
    key: "compliance_edge",
    description: "Caller asks legal/insurance edge-case questions",
    expected: {
      requiresEscalation: true,
      minNaturalness: 3.0,
      mustCollect: ["name", "postcode"],
    },
  },
];

export function scoreSimulationOutput(params: {
  transcript: string;
  collectedFields: string[];
  naturalnessScore: number;
  escalated: boolean;
  scenario: SimulationScenario;
}) {
  const required = params.scenario.expected.mustCollect;
  const missing = required.filter((field) => !params.collectedFields.includes(field));

  const escalationMismatch = params.escalated !== params.scenario.expected.requiresEscalation;
  const naturalnessFail = params.naturalnessScore < params.scenario.expected.minNaturalness;

  const passed = !escalationMismatch && !naturalnessFail && missing.length === 0;

  const penalties = [
    escalationMismatch ? 30 : 0,
    naturalnessFail ? 30 : 0,
    missing.length * 20,
  ].reduce((a, b) => a + b, 0);

  const score = Math.max(0, 100 - penalties);
  const failureReason = passed
    ? null
    : [
        escalationMismatch ? "escalation mismatch" : null,
        naturalnessFail ? "naturalness below threshold" : null,
        missing.length ? `missing fields: ${missing.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; ");

  return {
    passed,
    score,
    missing,
    failureReason,
  };
}
