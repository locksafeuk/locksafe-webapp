import { prisma } from "@/lib/prisma";

/**
 * Aggregated metrics snapshot sent to the Holding Dashboard.
 * Only contains counts/sums/dates — no PII.
 *
 * NOTE: PiDo Holding reads metric fields at the TOP LEVEL of the
 * payload. We therefore flatten every group's fields onto the root
 * object, while also keeping the nested groups for self-description.
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

  // Flat top-level metrics (read by PiDo dashboard)
  revenue_today: number;
  revenue_month: number;
  revenue_year: number;
  transactions_today: number;
  transactions_month: number;
  average_transaction_value: number;
  costs_month: number;
  estimated_profit_month: number;

  total_users: number;
  new_users_today: number;
  new_users_month: number;
  active_users_today: number;
  active_users_month: number;
  logins_month: number;

  visitors_month: number;
  signups_month: number;
  leads_month: number;
  customers_month: number;
  visitor_to_signup_rate: number;
  signup_to_customer_rate: number;
  lead_to_customer_rate: number;

  errors_24h: number;
  errors_7d: number;
  failed_jobs_24h: number;
  failed_payments_month: number;
  uptime_percentage: number;
  last_deploy_at: string;
  last_successful_cron_at: string;

  open_support_tickets: number;
  unresolved_errors: number;
  pending_admin_actions: number;
  database_size_mb: number;
  api_latency_ms: number;
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

  // PiDo Holding's schema rejects null for numeric fields, so coerce to 0
  // for the flat top-level mirror. Date string fields keep null.
  const n = (v: number | null | undefined): number => (v == null ? 0 : v);

  const platform = buildPlatformBlock();
  return {
    platform_id: platform.id,
    platform,
    period: buildPeriodBlock(now),

    // Flat top-level mirror — PiDo dashboard reads these directly
    revenue_today: n(business.revenue_today),
    revenue_month: n(business.revenue_month),
    revenue_year: n(business.revenue_year),
    transactions_today: n(business.transactions_today),
    transactions_month: n(business.transactions_month),
    average_transaction_value: n(business.average_transaction_value),
    costs_month: n(business.costs_month),
    estimated_profit_month: n(business.estimated_profit_month),

    total_users: n(usage.total_users),
    new_users_today: n(usage.new_users_today),
    new_users_month: n(usage.new_users_month),
    active_users_today: n(usage.active_users_today),
    active_users_month: n(usage.active_users_month),
    logins_month: n(usage.logins_month),

    visitors_month: n(conversion.visitors_month),
    signups_month: n(conversion.signups_month),
    leads_month: n(conversion.leads_month),
    customers_month: n(conversion.customers_month),
    visitor_to_signup_rate: n(conversion.visitor_to_signup_rate),
    signup_to_customer_rate: n(conversion.signup_to_customer_rate),
    lead_to_customer_rate: n(conversion.lead_to_customer_rate),

    errors_24h: n(technical.errors_24h),
    errors_7d: n(technical.errors_7d),
    failed_jobs_24h: n(technical.failed_jobs_24h),
    failed_payments_month: n(technical.failed_payments_month),
    uptime_percentage: n(technical.uptime_percentage),
    last_deploy_at: technical.last_deploy_at ?? now.toISOString(),
    last_successful_cron_at: technical.last_successful_cron_at ?? now.toISOString(),

    open_support_tickets: n(maintenance.open_support_tickets),
    unresolved_errors: n(maintenance.unresolved_errors),
    pending_admin_actions: n(maintenance.pending_admin_actions),
    database_size_mb: n(maintenance.database_size_mb),
    api_latency_ms: n(maintenance.api_latency_ms),

    // Nested groups kept for self-description
    business,
    usage,
    conversion,
    technical,
    maintenance,
  };
}
