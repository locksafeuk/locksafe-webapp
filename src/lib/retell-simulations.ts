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
      mustCollect: ["name", "postcode", "phone", "job_reference", "sms_link_sent"],
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
      mustCollect: ["name", "postcode", "service", "preferred_slot", "phone", "job_reference", "sms_link_sent"],
    },
  },
  {
    key: "price_objection",
    description: "Caller challenges quote and asks for cheaper alternatives",
    expected: {
      requiresEscalation: false,
      minNaturalness: 3.4,
      mustCollect: ["name", "postcode", "problem", "phone", "job_reference", "sms_link_sent"],
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
  const transcript = params.transcript.toLowerCase();

  const forbiddenTranscriptFlags = [
    /do not handle .*lockout/i,
    /does not handle .*lockout/i,
    /lockouts? are outside scope/i,
    /account lockouts? are outside scope/i,
    /ending the conversation early as there might be a loop/i,
    /online account recovery/i,
  ].filter((pattern) => pattern.test(transcript));

  if ((params.collectedFields.includes("sms_link_sent") || params.collectedFields.includes("job_reference")) && /sms (was )?sent|text (was )?sent|link (was )?sent/i.test(transcript) === false) {
    // Keep the score focused on explicit confirmation in transcripts for the email/SMS workflow.
  }

  const escalationMismatch = params.escalated !== params.scenario.expected.requiresEscalation;
  const naturalnessFail = params.naturalnessScore < params.scenario.expected.minNaturalness;
  const transcriptPolicyFail = forbiddenTranscriptFlags.length > 0;

  const passed = !escalationMismatch && !naturalnessFail && missing.length === 0 && !transcriptPolicyFail;

  const penalties = [
    escalationMismatch ? 30 : 0,
    naturalnessFail ? 30 : 0,
    transcriptPolicyFail ? 25 : 0,
    missing.length * 20,
  ].reduce((a, b) => a + b, 0);

  const score = Math.max(0, 100 - penalties);
  const failureReason = passed
    ? null
    : [
        escalationMismatch ? "escalation mismatch" : null,
        naturalnessFail ? "naturalness below threshold" : null,
        transcriptPolicyFail ? `transcript policy violation: ${forbiddenTranscriptFlags.length ? "lockout/or loop scope language" : "confirmation mismatch"}` : null,
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
