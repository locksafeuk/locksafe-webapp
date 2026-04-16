import { prisma } from "@/lib/db";

// Device type detection
export function getDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return "mobile";
  if (/tablet|ipad/i.test(userAgent)) return "tablet";
  return "desktop";
}

// Browser detection
export function getBrowser(userAgent: string): string {
  if (/firefox/i.test(userAgent)) return "Firefox";
  if (/edg/i.test(userAgent)) return "Edge";
  if (/chrome/i.test(userAgent)) return "Chrome";
  if (/safari/i.test(userAgent)) return "Safari";
  if (/opera|opr/i.test(userAgent)) return "Opera";
  return "Unknown";
}

// Create or get user session
export async function getOrCreateSession(
  visitorId: string,
  data: {
    userAgent: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    landingPage: string;
  }
) {
  // Try to find existing session (within last 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

  let session = await prisma.userSession.findFirst({
    where: {
      visitorId,
      lastActiveAt: {
        gte: thirtyMinutesAgo,
      },
    },
    orderBy: {
      lastActiveAt: "desc",
    },
  });

  if (session) {
    // Update last active
    session = await prisma.userSession.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
    return session;
  }

  // Create new session
  session = await prisma.userSession.create({
    data: {
      visitorId,
      deviceType: getDeviceType(data.userAgent),
      browser: getBrowser(data.userAgent),
      referrer: data.referrer || null,
      utmSource: data.utmSource || null,
      utmMedium: data.utmMedium || null,
      utmCampaign: data.utmCampaign || null,
      landingPage: data.landingPage,
      segment: [],
      modalsShown: [],
      modalsDismissed: [],
      modalsConverted: [],
    },
  });

  return session;
}

// Track page view
export async function trackPageView(
  sessionId: string,
  path: string,
  title?: string
) {
  return prisma.pageView.create({
    data: {
      sessionId,
      path,
      title,
    },
  });
}

// Track user event
export async function trackEvent(
  sessionId: string,
  type: string,
  element?: string,
  data?: Record<string, unknown>
) {
  return prisma.userEvent.create({
    data: {
      sessionId,
      type,
      element,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
    },
  });
}

// Update page view with time on page and scroll depth
export async function updatePageView(
  pageViewId: string,
  updates: {
    timeOnPage?: number;
    scrollDepth?: number;
  }
) {
  return prisma.pageView.update({
    where: { id: pageViewId },
    data: updates,
  });
}

// Track modal interaction
export async function trackModalInteraction(
  visitorId: string,
  sessionId: string,
  modalType: string,
  action: "shown" | "dismissed" | "converted" | "completed",
  data?: Record<string, unknown>,
  triggerId?: string,
  customerId?: string
) {
  // Create interaction record
  await prisma.modalInteraction.create({
    data: {
      visitorId,
      sessionId,
      modalType,
      action,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      triggerId,
      customerId,
    },
  });

  // Update session modal history
  const field =
    action === "shown"
      ? "modalsShown"
      : action === "dismissed"
        ? "modalsDismissed"
        : "modalsConverted";

  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (session) {
    const currentArray = session[field] as string[];
    if (!currentArray.includes(modalType)) {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          [field]: [...currentArray, modalType],
        },
      });
    }
  }

  return true;
}

// Update user segment
export async function updateUserSegment(
  sessionId: string,
  newSegments: string[]
) {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (session) {
    const currentSegments = session.segment as string[];
    const uniqueSegments = [...new Set([...currentSegments, ...newSegments])];

    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        segment: uniqueSegments,
      },
    });
  }

  return true;
}

// Update engagement score
export async function updateEngagementScore(
  sessionId: string,
  points: number
) {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      engagementScore: { increment: points },
    },
  });
}

// Update intent score
export async function updateIntentScore(sessionId: string, points: number) {
  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      intentScore: { increment: points },
    },
  });
}

// Save lead magnet signup
export async function saveLeadMagnet(data: {
  email: string;
  name?: string;
  phone?: string;
  source: string;
  segment: string[];
}) {
  // Check if email exists
  const existing = await prisma.leadMagnet.findFirst({
    where: { email: data.email },
  });

  if (existing) {
    // Update existing
    return prisma.leadMagnet.update({
      where: { id: existing.id },
      data: {
        name: data.name || existing.name,
        phone: data.phone || existing.phone,
        segment: [...new Set([...(existing.segment as string[]), ...data.segment])],
      },
    });
  }

  // Create new
  return prisma.leadMagnet.create({
    data: {
      email: data.email,
      name: data.name,
      phone: data.phone,
      source: data.source,
      segment: data.segment,
      downloaded: [],
      emailsSent: [],
      emailsOpened: [],
      emailsClicked: [],
    },
  });
}

// Get session with full tracking data
export async function getSessionWithTracking(sessionId: string) {
  return prisma.userSession.findUnique({
    where: { id: sessionId },
    include: {
      pageViews: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
}

// Check if modal should be shown (based on history and cooldown)
// Increased default cooldown from 24 to 48 hours for better UX
export async function shouldShowModal(
  visitorId: string,
  modalType: string,
  cooldownHours: number = 48,
  maxShows: number = 1
): Promise<boolean> {
  const cooldownTime = new Date(Date.now() - cooldownHours * 60 * 60 * 1000);

  // Check recent interactions
  const recentInteractions = await prisma.modalInteraction.count({
    where: {
      visitorId,
      modalType,
      createdAt: { gte: cooldownTime },
    },
  });

  if (recentInteractions >= maxShows) {
    return false;
  }

  // Check if user already converted on this modal
  const conversions = await prisma.modalInteraction.count({
    where: {
      visitorId,
      modalType,
      action: { in: ["converted", "completed"] },
    },
  });

  return conversions === 0;
}
