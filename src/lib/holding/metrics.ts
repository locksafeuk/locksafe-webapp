import { prisma } from "@/lib/prisma";

/**
 * Aggregated metrics snapshot sent to the Holding Dashboard.
 * Only contains counts/sums/dates — no PII.
 */
export interface HoldingMetricsSnapshot {
  platform_id: string;
  platform: {
    id: string;
    domain: string;
    industry: string;
    status: string;
    version: string;
    environment: string;
  };
  period: {
    date: string; // YYYY-MM-DD UTC
    month: string; // YYYY-MM UTC
  };
  business: {
    revenue_today: number;
    revenue_month: number;
    revenue_year: number;
    transactions_today: number;
    transactions_month: number;
    average_transaction_value: number | null;
    costs_month: number | null;
    estimated_profit_month: number | null;
  };
  usage: {
    total_users: number;
    new_users_today: number;
    new_users_month: number;
    active_users_today: number | null;
    active_users_month: number | null;
    logins_month: number | null;
  };
  conversion: {
    visitors_month: number | null;
    signups_month: number;
    leads_month: number;
    customers_month: number;
    visitor_to_signup_rate: number | null;
    signup_to_customer_rate: number | null;
    lead_to_customer_rate: number | null;
  };
  technical: {
    errors_24h: number | null;
    errors_7d: number | null;
    failed_jobs_24h: number | null;
    failed_payments_month: number;
    uptime_percentage: number | null;
    last_deploy_at: string | null;
    last_successful_cron_at: string | null;
  };
  maintenance: {
    open_support_tickets: number | null;
    unresolved_errors: number | null;
    pending_admin_actions: number | null;
    database_size_mb: number | null;
    api_latency_ms: number | null;
  };
}

const PLATFORM_VERSION = "1.0.4";

function startOfUtcDay(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcMonth(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfUtcYear(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function safeRate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildPlatformBlock(): HoldingMetricsSnapshot["platform"] {
  return {
    id: process.env.HOLDING_PLATFORM_ID || "locksafeuk",
    domain: "locksafe.uk",
    industry: "locksmith",
    status: "live",
    version: PLATFORM_VERSION,
    environment: process.env.NODE_ENV === "production" ? "production" : (process.env.NODE_ENV || "development"),
  };
}

function buildPeriodBlock(now: Date): HoldingMetricsSnapshot["period"] {
  const date = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  return { date, month };
}

async function collectBusiness(now: Date): Promise<HoldingMetricsSnapshot["business"]> {
  const fallback: HoldingMetricsSnapshot["business"] = {
    revenue_today: 0,
    revenue_month: 0,
    revenue_year: 0,
    transactions_today: 0,
    transactions_month: 0,
    average_transaction_value: null,
    costs_month: null,
    estimated_profit_month: null,
  };

  try {
    const dayStart = startOfUtcDay(now);
    const monthStart = startOfUtcMonth(now);
    const yearStart = startOfUtcYear(now);

    const [todayAgg, monthAgg, yearAgg] = await Promise.all([
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: { status: "succeeded", paidAt: { gte: dayStart } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { _all: true },
        where: { status: "succeeded", paidAt: { gte: monthStart } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "succeeded", paidAt: { gte: yearStart } },
      }),
    ]);

    const revenueToday = Number(todayAgg._sum.amount || 0);
    const revenueMonth = Number(monthAgg._sum.amount || 0);
    const revenueYear = Number(yearAgg._sum.amount || 0);
    const txToday = todayAgg._count._all || 0;
    const txMonth = monthAgg._count._all || 0;
    const avg = txMonth > 0 ? Number((revenueMonth / txMonth).toFixed(2)) : null;

    return {
      revenue_today: Number(revenueToday.toFixed(2)),
      revenue_month: Number(revenueMonth.toFixed(2)),
      revenue_year: Number(revenueYear.toFixed(2)),
      transactions_today: txToday,
      transactions_month: txMonth,
      average_transaction_value: avg,
      costs_month: null,
      estimated_profit_month: null,
    };
  } catch (err) {
    console.error("[holding-metrics] business group failed:", (err as Error)?.message);
    return fallback;
  }
}

async function collectUsage(now: Date): Promise<HoldingMetricsSnapshot["usage"]> {
  const fallback: HoldingMetricsSnapshot["usage"] = {
    total_users: 0,
    new_users_today: 0,
    new_users_month: 0,
    active_users_today: null,
    active_users_month: null,
    logins_month: null,
  };

  try {
    const dayStart = startOfUtcDay(now);
    const monthStart = startOfUtcMonth(now);

    const [total, newToday, newMonth] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { createdAt: { gte: dayStart } } }),
      prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    let activeToday: number | null = null;
    let activeMonth: number | null = null;
    let loginsMonth: number | null = null;
    try {
      [activeToday, activeMonth, loginsMonth] = await Promise.all([
        prisma.userSession.count({ where: { lastActiveAt: { gte: dayStart } } }),
        prisma.userSession.count({ where: { lastActiveAt: { gte: monthStart } } }),
        prisma.userSession.count({ where: { startedAt: { gte: monthStart } } }),
      ]);
    } catch (innerErr) {
      console.error("[holding-metrics] userSession metrics failed:", (innerErr as Error)?.message);
    }

    return {
      total_users: total,
      new_users_today: newToday,
      new_users_month: newMonth,
      active_users_today: activeToday,
      active_users_month: activeMonth,
      logins_month: loginsMonth,
    };
  } catch (err) {
    console.error("[holding-metrics] usage group failed:", (err as Error)?.message);
    return fallback;
  }
}

async function collectConversion(now: Date): Promise<HoldingMetricsSnapshot["conversion"]> {
  const fallback: HoldingMetricsSnapshot["conversion"] = {
    visitors_month: null,
    signups_month: 0,
    leads_month: 0,
    customers_month: 0,
    visitor_to_signup_rate: null,
    signup_to_customer_rate: null,
    lead_to_customer_rate: null,
  };

  try {
    const monthStart = startOfUtcMonth(now);

    let visitorsMonth: number | null = null;
    try {
      const sessions = await prisma.userSession.count({
        where: { startedAt: { gte: monthStart } },
      });
      visitorsMonth = sessions;
    } catch (innerErr) {
      console.error("[holding-metrics] visitors metric failed:", (innerErr as Error)?.message);
    }

    const [signupsMonth, leadsMonth, completedJobs] = await Promise.all([
      prisma.customer.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.job.count({
        where: {
          createdAt: { gte: monthStart },
          status: { in: ["PHONE_INITIATED", "PENDING"] },
        },
      }),
      prisma.job.findMany({
        where: {
          createdAt: { gte: monthStart },
          status: { in: ["COMPLETED", "SIGNED"] },
        },
        select: { customerId: true },
      }),
    ]);

    const customersMonth = new Set(completedJobs.map((j) => j.customerId)).size;

    return {
      visitors_month: visitorsMonth,
      signups_month: signupsMonth,
      leads_month: leadsMonth,
      customers_month: customersMonth,
      visitor_to_signup_rate: visitorsMonth ? safeRate(signupsMonth, visitorsMonth) : null,
      signup_to_customer_rate: safeRate(customersMonth, signupsMonth),
      lead_to_customer_rate: safeRate(customersMonth, leadsMonth),
    };
  } catch (err) {
    console.error("[holding-metrics] conversion group failed:", (err as Error)?.message);
    return fallback;
  }
}

async function collectTechnical(now: Date): Promise<HoldingMetricsSnapshot["technical"]> {
  const fallback: HoldingMetricsSnapshot["technical"] = {
    errors_24h: null,
    errors_7d: null,
    failed_jobs_24h: null,
    failed_payments_month: 0,
    uptime_percentage: null,
    last_deploy_at: null,
    last_successful_cron_at: null,
  };

  try {
    const monthStart = startOfUtcMonth(now);
    const failedPaymentsMonth = await prisma.payment.count({
      where: { status: "failed", createdAt: { gte: monthStart } },
    });

    return {
      errors_24h: null,
      errors_7d: null,
      failed_jobs_24h: null,
      failed_payments_month: failedPaymentsMonth,
      uptime_percentage: null,
      last_deploy_at: null,
      last_successful_cron_at: null,
    };
  } catch (err) {
    console.error("[holding-metrics] technical group failed:", (err as Error)?.message);
    return fallback;
  }
}

async function collectMaintenance(): Promise<HoldingMetricsSnapshot["maintenance"]> {
  const fallback: HoldingMetricsSnapshot["maintenance"] = {
    open_support_tickets: null,
    unresolved_errors: null,
    pending_admin_actions: null,
    database_size_mb: null,
    api_latency_ms: null,
  };

  try {
    let latency: number | null = null;
    try {
      const t0 = Date.now();
      await prisma.$runCommandRaw({ ping: 1 });
      latency = Date.now() - t0;
    } catch (innerErr) {
      console.error("[holding-metrics] db ping failed:", (innerErr as Error)?.message);
    }

    return {
      open_support_tickets: null,
      unresolved_errors: null,
      pending_admin_actions: null,
      database_size_mb: null,
      api_latency_ms: latency,
    };
  } catch (err) {
    console.error("[holding-metrics] maintenance group failed:", (err as Error)?.message);
    return fallback;
  }
}

export async function collectHoldingMetrics(): Promise<HoldingMetricsSnapshot> {
  const now = new Date();

  const [business, usage, conversion, technical, maintenance] = await Promise.all([
    collectBusiness(now),
    collectUsage(now),
    collectConversion(now),
    collectTechnical(now),
    collectMaintenance(),
  ]);

  const platform = buildPlatformBlock();
  return {
    platform_id: platform.id,
    platform,
    period: buildPeriodBlock(now),
    business,
    usage,
    conversion,
    technical,
    maintenance,
  };
}
