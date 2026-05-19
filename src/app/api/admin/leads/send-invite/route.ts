import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLocksmithFollowUpEmail, sendLocksmithInviteEmail } from "@/lib/email";
import { sendAdminAlert } from "@/lib/telegram";
import {
  appendSendEvent,
  hasTouchForTrack,
  isLikelyManagerLead,
  type OutreachTrack,
  type OutreachSubjectStyle,
} from "@/lib/lead-outreach";

type LeadForOutreach = {
  id: string;
  name: string;
  city: string;
  email: string | null;
  reviewCount: number;
  status: string;
  contactedAt: Date | null;
  notes: string | null;
};

function daysBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

function variantKey(track: OutreachTrack, style: OutreachSubjectStyle, touch: number, variant: number) {
  return `${track}|${style}|t${touch}|v${variant}`;
}

function getInviteContent(
  lead: { name: string; city: string; id: string },
  config: {
    track: OutreachTrack;
    style: OutreachSubjectStyle;
    touch: number;
    variant: number;
    baseUrl: string;
  },
) {
  const key = variantKey(config.track, config.style, config.touch, config.variant);
  const directSubjects: Record<OutreachTrack, string[]> = {
    independent: [
      "Custom commission options now available for locksmith partners",
      "Increase your take-home per locksmith job",
      "Join LockSafe and keep more from each completed job",
    ],
    manager: [
      "Custom commissions for locksmith team managers",
      "Offer better split structures to your locksmith team",
      "Flexible commission setup for growing locksmith companies",
    ],
  };

  const benefitSubjects: Record<OutreachTrack, string[]> = {
    independent: [
      "New local locksmith opportunities in your area",
      "Grow your locksmith earnings without extra admin",
      "Ready for more jobs with transparent payouts?",
    ],
    manager: [
      "Scale your locksmith team without extra overhead",
      "Onboard multiple engineers in one streamlined flow",
      "Built for locksmith managers ready to grow",
    ],
  };

  const subjects = config.style === "direct" ? directSubjects : benefitSubjects;
  const safeIndex = Math.max(0, Math.min(config.variant - 1, subjects[config.track].length - 1));
  const subject = subjects[config.track][safeIndex];

  const signupTarget = `${config.baseUrl}/for-locksmiths?utm_source=lead_email&utm_medium=outreach&utm_campaign=lead-sequence&utm_content=${encodeURIComponent(key)}`;
  const trackedCta = `${config.baseUrl}/api/admin/leads/track?type=click&leadId=${lead.id}&key=${encodeURIComponent(key)}&url=${encodeURIComponent(signupTarget)}`;
  const trackPixel = `${config.baseUrl}/api/admin/leads/track?type=open&leadId=${lead.id}&key=${encodeURIComponent(key)}`;

  const touchOpeners: Record<number, string> = {
    1: `We're reaching out because your locksmith business in ${lead.city} looks like a strong fit for LockSafe UK.`,
    2: `Quick follow-up in case you missed this: we're still onboarding trusted locksmiths in ${lead.city}.`,
    3: `Final nudge from us for now: we still have active demand in ${lead.city} and can onboard you quickly.`,
  };

  const managerIntro =
    "If you manage multiple engineers, you can onboard your team under one structure and use flexible split settings as you scale.";
  const independentIntro =
    "As an independent locksmith, you can keep control of your jobs while improving earnings visibility and payout speed.";

  return {
    key,
    subject,
    ctaText: config.track === "manager" ? "Start Team Onboarding" : "Complete Locksmith Signup",
    signupUrl: trackedCta,
    trackPixelUrl: trackPixel,
    introOverride: `${touchOpeners[config.touch] || touchOpeners[1]} ${config.track === "manager" ? managerIntro : independentIntro}`,
  };
}

function getFollowUpContent(
  lead: { name: string; city: string; id: string },
  config: {
    track: OutreachTrack;
    style: OutreachSubjectStyle;
    touch: number;
    variant: number;
    baseUrl: string;
  },
) {
  const key = variantKey(config.track, config.style, config.touch, config.variant);
  const directSubjects: Record<OutreachTrack, string[]> = {
    independent: [
      "Commission structure for locksmith partners",
      "Your LockSafe payout breakdown",
      "Earnings split for your next locksmith job",
    ],
    manager: [
      "Commission structure for team managers",
      "Team split settings and payout clarity",
      "Your team onboarding and commission breakdown",
    ],
  };

  const benefitSubjects: Record<OutreachTrack, string[]> = {
    independent: [
      "It seems like the numbers matter",
      "A clearer look at the locksmith partner offer",
      "What the earnings breakdown looks like",
    ],
    manager: [
      "It seems like team flexibility matters",
      "A clearer look at team onboarding",
      "What the split structure looks like",
    ],
  };

  const subjects = config.style === "direct" ? directSubjects : benefitSubjects;
  const safeIndex = Math.max(0, Math.min(config.variant - 1, subjects[config.track].length - 1));
  const subject = subjects[config.track][safeIndex];
  const signupTarget = `${config.baseUrl}/for-locksmiths?utm_source=lead_email&utm_medium=outreach&utm_campaign=lead-sequence_followup&utm_content=${encodeURIComponent(key)}`;
  const trackedCta = `${config.baseUrl}/api/admin/leads/track?type=click&leadId=${lead.id}&key=${encodeURIComponent(key)}&url=${encodeURIComponent(signupTarget)}`;
  const trackPixel = `${config.baseUrl}/api/admin/leads/track?type=open&leadId=${lead.id}&key=${encodeURIComponent(key)}`;

  return {
    key,
    subject,
    ctaText: config.track === "manager" ? "Review Team Setup" : "Review the Breakdown",
    signupUrl: trackedCta,
    trackPixelUrl: trackPixel,
  };
}

function buildFollowUpEmailCopy(track: OutreachTrack, leadName: string, city: string) {
  const benefits =
    track === "manager"
      ? [
          "Bring your team onto one clear workflow instead of juggling separate job streams.",
          "Keep split settings visible so you can decide what works best for your operation.",
          "Use one platform for lead flow, team coordination, and customer communication.",
        ]
      : [
          "Receive verified local jobs without paying monthly fees.",
          "Keep control over which jobs you accept and how you work them.",
          "Move faster with a clear payment flow and less admin.",
        ];

  const commissionRows =
    track === "manager"
      ? [
          "Assessment fee: 15% standard platform commission",
          "Work quote: 25% standard platform commission",
          "Team structure: split settings can be discussed with your team setup",
        ]
      : [
          "Assessment fee: 15% platform commission",
          "Work quote: 25% platform commission",
          "Payouts: clear, tracked job-by-job earnings",
        ];

  return [
    `Hi ${leadName},`,
    "",
    "It seems like the main question after the first email is simple: what does this actually look like for your time and earnings?",
    "",
    "What locksmiths usually want to know:",
    ...benefits.map((benefit) => `• ${benefit}`),
    "",
    "Commission structure:",
    ...commissionRows.map((row) => `• ${row}`),
    "",
    `CTA: ${track === "manager" ? "Review Team Setup" : "Review the Breakdown"}`,
    `Location context: ${city}`,
  ].join("\n");
}

function buildSequenceEmailCopy(
  track: OutreachTrack,
  touch: number,
  leadName: string,
  city: string,
) {
  if (touch === 2) {
    return buildFollowUpEmailCopy(track, leadName, city);
  }

  const benefits =
    track === "manager"
      ? [
          "Bring your team onto one clear workflow instead of juggling separate job streams.",
          "Keep split settings visible so you can decide what works best for your operation.",
          "Use one platform for lead flow, team coordination, and customer communication.",
        ]
      : [
          "Receive verified local jobs without paying monthly fees.",
          "Keep control over which jobs you accept and how you work them.",
          "Move faster with a clear payment flow and less admin.",
        ];

  const opener =
    touch === 1
      ? `We're reaching out because your locksmith business in ${city} looks like a strong fit for LockSafe UK.`
      : `Final nudge from us for now: we still have active demand in ${city} and can onboard you quickly.`;

  return [
    `Hi ${leadName},`,
    "",
    opener,
    "",
    "Benefits:",
    ...benefits.map((benefit) => `• ${benefit}`),
    "",
    `CTA: ${track === "manager" ? "Start Team Onboarding" : "Complete Locksmith Signup"}`,
    `Location context: ${city}`,
  ].join("\n");
}

function filterEligibleSequenceLeads(
  leads: LeadForOutreach[],
  cfg: { track: OutreachTrack; touch: number; now: Date },
) {
  return leads.filter((lead) => {
    if (!lead.email) return false;

    const isManager = isLikelyManagerLead(lead.name, lead.reviewCount);
    if (cfg.track === "manager" && !isManager) return false;
    if (cfg.track === "independent" && isManager) return false;

    if (cfg.touch === 1) {
      return lead.status === "new" && !hasTouchForTrack(lead.notes, cfg.track, 1);
    }

    if (cfg.touch === 2) {
      if (!(lead.status === "contacted" || lead.status === "replied")) return false;
      if (!lead.contactedAt) return false;
      if (daysBetween(lead.contactedAt, cfg.now) < 3) return false;
      return hasTouchForTrack(lead.notes, cfg.track, 1) && !hasTouchForTrack(lead.notes, cfg.track, 2);
    }

    if (cfg.touch === 3) {
      if (!(lead.status === "contacted" || lead.status === "replied")) return false;
      if (!lead.contactedAt) return false;
      if (daysBetween(lead.contactedAt, cfg.now) < 7) return false;
      return hasTouchForTrack(lead.notes, cfg.track, 2) && !hasTouchForTrack(lead.notes, cfg.track, 3);
    }

    return false;
  });
}

// POST /api/admin/leads/send-invite
// Body: { id: string }  — single lead
// Body: { ids: string[] } — bulk send
export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = req.headers.get("x-vercel-cron") === "1";
  const hasCronSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  if ((!payload || payload.type !== "admin") && !isCron && !hasCronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] = body.ids ?? (body.id ? [body.id] : []);
  const mode = body.mode === "sequence" ? "sequence" : "manual";
  const track: OutreachTrack = body.track === "manager" ? "manager" : "independent";
  const style: OutreachSubjectStyle = body.subjectStyle === "direct" ? "direct" : "benefit";
  const touch = Number(body.touch || 1);
  const variant = Number(body.variant || 1);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.locksafe.uk";

  let targets: LeadForOutreach[] = [];

  if (mode === "manual") {
    if (ids.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    targets = await prisma.locksmithLead.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        city: true,
        email: true,
        reviewCount: true,
        status: true,
        contactedAt: true,
        notes: true,
      },
    }) as LeadForOutreach[];
  } else {
    if (![1, 2, 3].includes(touch)) {
      return NextResponse.json({ error: "touch must be 1, 2 or 3" }, { status: 400 });
    }

    const leadPool = await prisma.locksmithLead.findMany({
      where: { email: { not: null } },
      select: {
        id: true,
        name: true,
        city: true,
        email: true,
        reviewCount: true,
        status: true,
        contactedAt: true,
        notes: true,
      },
    }) as LeadForOutreach[];

    targets = filterEligibleSequenceLeads(leadPool, {
      track,
      touch,
      now: new Date(),
    });
  }

  if (targets.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      results: [],
      message: mode === "sequence" ? "No eligible leads found for this sequence touch" : "No leads found",
    });
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const lead of targets) {
    try {
      if (!lead.email) {
        results.push({ id: lead.id, success: false, error: "No email address" });
        continue;
      }

      const content = getInviteContent(
        { id: lead.id, name: lead.name, city: lead.city },
        {
          track,
          style,
          touch: mode === "sequence" ? touch : 1,
          variant,
          baseUrl,
        },
      );

      const emailResult =
        touch === 2 && mode === "sequence"
          ? await sendLocksmithFollowUpEmail(
              lead.email,
              {
                locksmithName: lead.name,
                city: lead.city,
              },
              {
                ...getFollowUpContent(
                  { id: lead.id, name: lead.name, city: lead.city },
                  {
                    track,
                    style,
                    touch,
                    variant,
                    baseUrl,
                  },
                ),
                track,
              },
            )
          : await sendLocksmithInviteEmail(
              lead.email,
              {
                locksmithName: lead.name,
                city: lead.city,
              },
              {
                subject: content.subject,
                signupUrl: content.signupUrl,
                ctaText: content.ctaText,
                introOverride: content.introOverride,
                trackPixelUrl: content.trackPixelUrl,
              },
            );

      if (emailResult.success) {
        const nextNotes = appendSendEvent(lead.notes, {
          key: content.key,
          touch: mode === "sequence" ? touch : 1,
          track,
          style,
          variant,
          sentAt: new Date().toISOString(),
        });

        await prisma.locksmithLead.update({
          where: { id: lead.id },
          data: {
            status: "contacted",
            contactedAt: new Date(),
            contactedBy: mode === "sequence" ? `invite-seq-t${touch}` : "invite-email",
            notes: nextNotes,
          },
        });
        results.push({ id: lead.id, success: true });
      } else {
        results.push({ id: lead.id, success: false, error: "Email send failed" });
      }
    } catch (err) {
      results.push({ id: lead.id, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }

    // Small delay between sends to stay within rate limits
    if (targets.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (mode === "sequence" && touch === 2 && results.some((result) => result.success)) {
    const previewLead = targets[0];
    const followUpContent = getFollowUpContent(
      { id: previewLead.id, name: previewLead.name, city: previewLead.city },
      {
        track,
        style,
        touch,
        variant,
        baseUrl,
      },
    );

    await sendAdminAlert({
      title: `Follow-up email batch sent (${track})`,
      message: [
        `Touch: 2-day follow-up`,
        `Track: ${track}`,
        `Style: ${style}`,
        `Variant: ${variant}`,
        `Recipients attempted: ${targets.length}`,
        `Sent: ${results.filter((result) => result.success).length}`,
        `Failed: ${results.filter((result) => !result.success).length}`,
        `Subject: ${followUpContent.subject}`,
        "",
        "Email copy:",
        buildFollowUpEmailCopy(track, "[Lead Name]", "[City]"),
      ].join("\n"),
      severity: "info",
    });
  }

  if (mode === "sequence" && (touch === 1 || touch === 3) && results.some((result) => result.success)) {
    const previewLead = targets[0];
    const sequenceContent = getInviteContent(
      { id: previewLead.id, name: previewLead.name, city: previewLead.city },
      {
        track,
        style,
        touch,
        variant,
        baseUrl,
      },
    );

    await sendAdminAlert({
      title: `${touch === 1 ? "Initial" : "Final"} sequence email sent (${track})`,
      message: [
        `Touch: ${touch}`,
        `Track: ${track}`,
        `Style: ${style}`,
        `Variant: ${variant}`,
        `Recipients attempted: ${targets.length}`,
        `Sent: ${results.filter((result) => result.success).length}`,
        `Failed: ${results.filter((result) => !result.success).length}`,
        `Subject: ${sequenceContent.subject}`,
        "",
        "Email copy:",
        buildSequenceEmailCopy(track, touch, "[Lead Name]", "[City]"),
      ].join("\n"),
      severity: "info",
    });
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    sent,
    failed,
    results,
    sequence: {
      mode,
      track,
      style,
      touch: mode === "sequence" ? touch : 1,
      variant,
      attempted: targets.length,
    },
  });
}
