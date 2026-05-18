export type OutreachTrack = "independent" | "manager";
export type OutreachSubjectStyle = "direct" | "benefit";

export interface OutreachSendEvent {
  key: string;
  touch: number;
  track: OutreachTrack;
  style: OutreachSubjectStyle;
  variant: number;
  sentAt: string;
}

export interface OutreachMeta {
  sends: OutreachSendEvent[];
  opens: Record<string, number>;
  clicks: Record<string, number>;
}

const META_START = "[[OUTREACH_META]]";
const META_END = "[[/OUTREACH_META]]";

function defaultMeta(): OutreachMeta {
  return { sends: [], opens: {}, clicks: {} };
}

export function parseOutreachMeta(notes: string | null | undefined): OutreachMeta {
  if (!notes) return defaultMeta();

  const start = notes.indexOf(META_START);
  const end = notes.indexOf(META_END);

  if (start === -1 || end === -1 || end <= start) return defaultMeta();

  const json = notes.slice(start + META_START.length, end).trim();
  try {
    const parsed = JSON.parse(json) as Partial<OutreachMeta>;
    return {
      sends: Array.isArray(parsed.sends) ? parsed.sends : [],
      opens: parsed.opens && typeof parsed.opens === "object" ? parsed.opens : {},
      clicks: parsed.clicks && typeof parsed.clicks === "object" ? parsed.clicks : {},
    };
  } catch {
    return defaultMeta();
  }
}

export function stripOutreachMeta(notes: string | null | undefined): string {
  if (!notes) return "";
  const start = notes.indexOf(META_START);
  const end = notes.indexOf(META_END);
  if (start === -1 || end === -1 || end <= start) return notes.trim();

  const before = notes.slice(0, start).trim();
  const after = notes.slice(end + META_END.length).trim();

  if (before && after) return `${before}\n\n${after}`;
  return (before || after || "").trim();
}

export function withOutreachMeta(notes: string | null | undefined, meta: OutreachMeta): string {
  const base = stripOutreachMeta(notes);
  const packed = `${META_START}\n${JSON.stringify(meta)}\n${META_END}`;
  return base ? `${base}\n\n${packed}` : packed;
}

export function appendSendEvent(
  notes: string | null | undefined,
  event: OutreachSendEvent,
): string {
  const meta = parseOutreachMeta(notes);
  meta.sends.push(event);
  return withOutreachMeta(notes, meta);
}

export function incrementOutreachMetric(
  notes: string | null | undefined,
  key: string,
  type: "open" | "click",
): string {
  const meta = parseOutreachMeta(notes);
  if (type === "open") {
    meta.opens[key] = (meta.opens[key] || 0) + 1;
  } else {
    meta.clicks[key] = (meta.clicks[key] || 0) + 1;
  }
  return withOutreachMeta(notes, meta);
}

export function hasTouchForTrack(
  notes: string | null | undefined,
  track: OutreachTrack,
  touch: number,
): boolean {
  const meta = parseOutreachMeta(notes);
  return meta.sends.some((s) => s.track === track && s.touch === touch);
}

export function isLikelyManagerLead(leadName: string, reviewCount: number): boolean {
  const name = leadName.toLowerCase();
  return /\b(ltd|limited|llp|group|services|security|company)\b/.test(name) || reviewCount >= 250;
}

export interface OutreachAggregateRow {
  key: string;
  sends: number;
  opens: number;
  clicks: number;
  onboarded: number;
  openRate: number;
  clickRate: number;
  signupRate: number;
}

interface LeadLike {
  status: string;
  notes: string | null;
}

export function aggregateOutreachStats(leads: LeadLike[]): {
  totalSends: number;
  totalOpens: number;
  totalClicks: number;
  variants: OutreachAggregateRow[];
} {
  const map = new Map<string, { sends: number; opens: number; clicks: number; onboarded: number }>();

  for (const lead of leads) {
    const meta = parseOutreachMeta(lead.notes);
    const uniqueKeys = new Set<string>();

    for (const s of meta.sends) {
      const row = map.get(s.key) || { sends: 0, opens: 0, clicks: 0, onboarded: 0 };
      row.sends += 1;
      map.set(s.key, row);
      uniqueKeys.add(s.key);
    }

    for (const [k, count] of Object.entries(meta.opens)) {
      const row = map.get(k) || { sends: 0, opens: 0, clicks: 0, onboarded: 0 };
      row.opens += count;
      map.set(k, row);
    }

    for (const [k, count] of Object.entries(meta.clicks)) {
      const row = map.get(k) || { sends: 0, opens: 0, clicks: 0, onboarded: 0 };
      row.clicks += count;
      map.set(k, row);
    }

    if (lead.status === "onboarded") {
      for (const k of uniqueKeys) {
        const row = map.get(k) || { sends: 0, opens: 0, clicks: 0, onboarded: 0 };
        row.onboarded += 1;
        map.set(k, row);
      }
    }
  }

  const variants = Array.from(map.entries())
    .map(([key, row]) => ({
      key,
      sends: row.sends,
      opens: row.opens,
      clicks: row.clicks,
      onboarded: row.onboarded,
      openRate: row.sends > 0 ? Math.round((row.opens / row.sends) * 100) : 0,
      clickRate: row.sends > 0 ? Math.round((row.clicks / row.sends) * 100) : 0,
      signupRate: row.sends > 0 ? Math.round((row.onboarded / row.sends) * 100) : 0,
    }))
    .sort((a, b) => b.sends - a.sends);

  return {
    totalSends: variants.reduce((sum, v) => sum + v.sends, 0),
    totalOpens: variants.reduce((sum, v) => sum + v.opens, 0),
    totalClicks: variants.reduce((sum, v) => sum + v.clicks, 0),
    variants,
  };
}
