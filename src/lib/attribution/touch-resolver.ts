/**
 * touch-resolver.ts — single source of truth for first-touch / last-touch
 * attribution stamping.
 *
 * Architecture (decided 2026-06-12 audit + plan):
 *
 *   UserSession is the per-visit row (one per 30-min window). It carries
 *   the full UTM stack + gclid/fbclid/landingPage/referrer at click time.
 *
 *   Customer + Job + Locksmith ALSO carry attribution columns now. We
 *   stamp them at the moment of persist so dashboards can pivot without
 *   a UserSession join.
 *
 *   - firstTouch = the EARLIEST UserSession ever seen for this visitorId
 *     (orderBy startedAt asc). Immutable — only written once at create.
 *   - lastTouch  = the MOST RECENT UserSession for this visitorId
 *     (orderBy lastActiveAt desc). Refreshed on every meaningful action
 *     (login, job placement).
 *
 * Use:
 *   import { stampFirstAndLastTouchOn } from "@/lib/attribution/touch-resolver";
 *   const data = await stampFirstAndLastTouchOn({ name, email, phone }, visitorId);
 *   await prisma.customer.create({ data });
 *
 *   import { stampLastTouchOn } from "@/lib/attribution/touch-resolver";
 *   const update = await stampLastTouchOn({}, visitorId);
 *   await prisma.customer.update({ where: { id }, data: update });
 *
 * Resolver is intentionally side-effect-free; it returns the typed
 * snapshot. The caller chooses where to apply it (create vs update,
 * Customer vs Job vs Locksmith).
 */

import prisma from "@/lib/db";

/**
 * Snapshot of all attribution fields lifted out of a UserSession row.
 */
export interface TouchSnapshot {
  visitorId:   string;
  sessionId:   string;
  at:          Date;
  source:      string | null;
  medium:      string | null;
  campaign:    string | null;
  content:     string | null;
  term:        string | null;
  gclid:       string | null;
  fbclid:      string | null;
  msclkid:     string | null;
  landingPage: string | null;
  referrer:    string | null;
}

interface SessionRowShape {
  id?:            string;
  startedAt?:     Date | string;
  lastActiveAt?:  Date | string;
  utmSource?:     string | null;
  utmMedium?:     string | null;
  utmCampaign?:   string | null;
  utmContent?:    string | null;
  utmTerm?:       string | null;
  gclid?:         string | null;
  fbclid?:        string | null;
  msclkid?:       string | null;
  landingPage?:   string | null;
  referrer?:      string | null;
}

function toSnapshot(
  visitorId: string,
  session: SessionRowShape,
  whichTimestamp: "startedAt" | "lastActiveAt",
): TouchSnapshot {
  const raw = session[whichTimestamp];
  const at = raw instanceof Date ? raw : raw ? new Date(raw) : new Date();
  return {
    visitorId,
    sessionId:   session.id ?? "",
    at,
    source:      session.utmSource   ?? null,
    medium:      session.utmMedium   ?? null,
    campaign:    session.utmCampaign ?? null,
    content:     session.utmContent  ?? null,
    term:        session.utmTerm     ?? null,
    gclid:       session.gclid       ?? null,
    fbclid:      session.fbclid      ?? null,
    msclkid:     session.msclkid     ?? null,
    landingPage: session.landingPage ?? null,
    referrer:    session.referrer    ?? null,
  };
}

/**
 * Earliest UserSession for this visitor (by startedAt asc). The "where
 * did they FIRST come from" answer.
 */
export async function resolveFirstTouch(
  visitorId: string | null | undefined,
): Promise<TouchSnapshot | null> {
  if (!visitorId) return null;
  const session = await prisma.userSession.findFirst({
    where:   { visitorId },
    orderBy: { startedAt: "asc" },
  });
  if (!session) return null;
  return toSnapshot(visitorId, session as SessionRowShape, "startedAt");
}

/**
 * Most recent UserSession for this visitor (by lastActiveAt desc). The
 * "where did they LAST come from" answer.
 */
export async function resolveLastTouch(
  visitorId: string | null | undefined,
): Promise<TouchSnapshot | null> {
  if (!visitorId) return null;
  const session = await prisma.userSession.findFirst({
    where:   { visitorId },
    orderBy: { lastActiveAt: "desc" },
  });
  if (!session) return null;
  return toSnapshot(visitorId, session as SessionRowShape, "lastActiveAt");
}

/**
 * Spread a TouchSnapshot onto a Prisma create payload using the
 * firstTouch* column naming convention (Customer, Job, Locksmith).
 */
export function spreadFirstTouchOnto<T extends Record<string, unknown>>(
  data: T,
  snap: TouchSnapshot,
): T & {
  firstSessionId:        string;
  firstTouchAt:          Date;
  firstTouchSource:      string | null;
  firstTouchMedium:      string | null;
  firstTouchCampaign:    string | null;
  firstTouchContent:     string | null;
  firstTouchTerm:        string | null;
  firstTouchGclid:       string | null;
  firstTouchFbclid:      string | null;
  firstTouchMsclkid:     string | null;
  firstTouchLandingPage: string | null;
  firstTouchReferrer:    string | null;
} {
  return {
    ...data,
    firstSessionId:        snap.sessionId,
    firstTouchAt:          snap.at,
    firstTouchSource:      snap.source,
    firstTouchMedium:      snap.medium,
    firstTouchCampaign:    snap.campaign,
    firstTouchContent:     snap.content,
    firstTouchTerm:        snap.term,
    firstTouchGclid:       snap.gclid,
    firstTouchFbclid:      snap.fbclid,
    firstTouchMsclkid:     snap.msclkid,
    firstTouchLandingPage: snap.landingPage,
    firstTouchReferrer:    snap.referrer,
  };
}

/**
 * Spread a TouchSnapshot onto a Prisma create/update payload using the
 * lastTouch* column naming convention (Customer, Job).
 */
export function spreadLastTouchOnto<T extends Record<string, unknown>>(
  data: T,
  snap: TouchSnapshot,
): T & {
  lastSessionId:        string;
  lastTouchAt:          Date;
  lastTouchSource:      string | null;
  lastTouchMedium:      string | null;
  lastTouchCampaign:    string | null;
  lastTouchContent:     string | null;
  lastTouchTerm:        string | null;
  lastTouchGclid:       string | null;
  lastTouchFbclid:      string | null;
  lastTouchMsclkid:     string | null;
  lastTouchLandingPage: string | null;
  lastTouchReferrer:    string | null;
} {
  return {
    ...data,
    lastSessionId:        snap.sessionId,
    lastTouchAt:          snap.at,
    lastTouchSource:      snap.source,
    lastTouchMedium:      snap.medium,
    lastTouchCampaign:    snap.campaign,
    lastTouchContent:     snap.content,
    lastTouchTerm:        snap.term,
    lastTouchGclid:       snap.gclid,
    lastTouchFbclid:      snap.fbclid,
    lastTouchMsclkid:     snap.msclkid,
    lastTouchLandingPage: snap.landingPage,
    lastTouchReferrer:    snap.referrer,
  };
}

/**
 * One-shot: lift first+last touch from history for this visitor and
 * spread BOTH onto a Customer-create payload (or any model that has both
 * column sets). When the visitor has no UserSession history (phone-only
 * customer, admin-created), returns the input data unchanged + a default
 * firstTouchSource if a `fallbackSource` is provided.
 */
export async function stampFirstAndLastTouchOn<T extends Record<string, unknown>>(
  data: T,
  visitorId: string | null | undefined,
  opts: { fallbackSource?: string } = {},
): Promise<T> {
  if (!visitorId) {
    if (opts.fallbackSource) {
      return {
        ...data,
        firstTouchAt:     new Date(),
        firstTouchSource: opts.fallbackSource,
        lastTouchAt:      new Date(),
        lastTouchSource:  opts.fallbackSource,
      };
    }
    return data;
  }
  const [first, last] = await Promise.all([
    resolveFirstTouch(visitorId),
    resolveLastTouch(visitorId),
  ]);
  let out: Record<string, unknown> = { ...data, visitorId };
  if (first) out = spreadFirstTouchOnto(out, first);
  if (last)  out = spreadLastTouchOnto(out, last);
  if (!first && opts.fallbackSource) {
    out.firstTouchAt     = new Date();
    out.firstTouchSource = opts.fallbackSource;
  }
  if (!last && opts.fallbackSource) {
    out.lastTouchAt     = new Date();
    out.lastTouchSource = opts.fallbackSource;
  }
  return out as T;
}

/**
 * One-shot: lift last-touch from history and spread onto an update
 * payload. Used on login + on Job creation to refresh customer.lastTouch*.
 */
export async function stampLastTouchOn<T extends Record<string, unknown>>(
  data: T,
  visitorId: string | null | undefined,
): Promise<T> {
  if (!visitorId) return data;
  const last = await resolveLastTouch(visitorId);
  if (!last) return data;
  return spreadLastTouchOnto(data, last) as T;
}

/**
 * One-shot: lift first-touch only (locksmith register, Job firstTouch).
 */
export async function stampFirstTouchOn<T extends Record<string, unknown>>(
  data: T,
  visitorId: string | null | undefined,
  opts: { fallbackSource?: string } = {},
): Promise<T> {
  if (!visitorId) {
    if (opts.fallbackSource) {
      return {
        ...data,
        firstTouchAt:     new Date(),
        firstTouchSource: opts.fallbackSource,
      };
    }
    return data;
  }
  const first = await resolveFirstTouch(visitorId);
  if (!first) {
    if (opts.fallbackSource) {
      return {
        ...data,
        firstTouchAt:     new Date(),
        firstTouchSource: opts.fallbackSource,
      };
    }
    return data;
  }
  return spreadFirstTouchOnto({ ...data, visitorId }, first) as T;
}

/**
 * Convenience for /api/jobs which already has utmSource/utmMedium/gclid
 * on the Job row (those are the lastTouch values). Stamps BOTH the
 * existing fields AND the new firstTouch* set so the Job row carries the
 * complete cross-channel picture.
 */
export async function stampJobAttribution<T extends Record<string, unknown>>(
  data: T,
  visitorId: string | null | undefined,
): Promise<T> {
  if (!visitorId) return data;
  const [first, last] = await Promise.all([
    resolveFirstTouch(visitorId),
    resolveLastTouch(visitorId),
  ]);
  let out: Record<string, unknown> = { ...data };
  if (last) {
    out = {
      ...out,
      utmSource:   last.source,
      utmMedium:   last.medium,
      utmCampaign: last.campaign,
      utmContent:  last.content,
      utmTerm:     last.term,
      gclid:       last.gclid,
      fbclid:      last.fbclid,
      msclkid:     last.msclkid,
      landingPage: last.landingPage,
    };
  }
  if (first) out = spreadFirstTouchOnto(out, first);
  return out as T;
}
