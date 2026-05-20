export type RealismProfile = {
  interruptionSensitivity: string;
  backchannelFrequency: string;
  pauseStyle: string;
  noiseHandling: string;
  pronunciationHints?: string[];
};

export type RealismMatrixVariant = RealismProfile & {
  id: string;
  label: string;
  isBaseline: boolean;
  distance: number;
};

const INTERRUPTION_LEVELS = ["low", "medium", "high"] as const;
const BACKCHANNEL_LEVELS = ["low", "medium", "high"] as const;
const PAUSE_STYLES = ["concise", "natural", "empathetic"] as const;
const NOISE_HANDLING_LEVELS = ["adaptive", "strict", "lenient"] as const;

export const DEFAULT_REALISM_PROFILE: RealismProfile = {
  interruptionSensitivity: "medium",
  backchannelFrequency: "medium",
  pauseStyle: "natural",
  noiseHandling: "adaptive",
  pronunciationHints: [],
};

function asLevel<T extends string>(value: unknown, fallback: T, levels: readonly T[]) {
  return typeof value === "string" && (levels as readonly string[]).includes(value) ? (value as T) : fallback;
}

function scoreDistance(base: RealismProfile, variant: RealismProfile) {
  const dimensions: Array<keyof RealismProfile> = ["interruptionSensitivity", "backchannelFrequency", "pauseStyle", "noiseHandling"];
  return dimensions.reduce((sum, key) => (base[key] === variant[key] ? sum : sum + 1), 0);
}

export function normalizeRealismProfile(profile: unknown): RealismProfile {
  const raw = (profile ?? {}) as Record<string, unknown>;

  return {
    interruptionSensitivity: asLevel(raw.interruptionSensitivity, DEFAULT_REALISM_PROFILE.interruptionSensitivity, INTERRUPTION_LEVELS),
    backchannelFrequency: asLevel(raw.backchannelFrequency, DEFAULT_REALISM_PROFILE.backchannelFrequency, BACKCHANNEL_LEVELS),
    pauseStyle: asLevel(raw.pauseStyle, DEFAULT_REALISM_PROFILE.pauseStyle, PAUSE_STYLES),
    noiseHandling: asLevel(raw.noiseHandling, DEFAULT_REALISM_PROFILE.noiseHandling, NOISE_HANDLING_LEVELS),
    pronunciationHints: Array.isArray(raw.pronunciationHints)
      ? raw.pronunciationHints.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function buildRealismExperimentMatrix(profile: unknown): RealismMatrixVariant[] {
  const normalized = normalizeRealismProfile(profile);
  const matrix: RealismMatrixVariant[] = [];

  for (const interruptionSensitivity of INTERRUPTION_LEVELS) {
    for (const backchannelFrequency of BACKCHANNEL_LEVELS) {
      for (const pauseStyle of PAUSE_STYLES) {
        for (const noiseHandling of NOISE_HANDLING_LEVELS) {
          const variant: RealismProfile = {
            interruptionSensitivity,
            backchannelFrequency,
            pauseStyle,
            noiseHandling,
            pronunciationHints: normalized.pronunciationHints,
          };

          matrix.push({
            id: `${interruptionSensitivity}-${backchannelFrequency}-${pauseStyle}-${noiseHandling}`,
            label: `${interruptionSensitivity} / ${backchannelFrequency} / ${pauseStyle} / ${noiseHandling}`,
            isBaseline:
              normalized.interruptionSensitivity === interruptionSensitivity &&
              normalized.backchannelFrequency === backchannelFrequency &&
              normalized.pauseStyle === pauseStyle &&
              normalized.noiseHandling === noiseHandling,
            distance: scoreDistance(normalized, variant),
            ...variant,
          });
        }
      }
    }
  }

  return matrix.sort((a, b) => a.distance - b.distance || a.label.localeCompare(b.label));
}
