/**
 * GET /api/admin/google-ads/attribution-chain-diag
 *
 * Simplified diagnostic — bisected version. Each prisma call is wrapped
 * in its own try/catch so a single bad query reports its own error
 * instead of 500-ing the whole response.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma as _prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

async function step<T>(label: string, fn: () => Promise<T>) {
  try {
    return { label, ok: true, value: await fn() };
  } catch (e) {
    return {
      label,
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const results = {
    sessionsTotal: await step("sessionsTotal", () =>
      prisma.userSession.count({ where: { createdAt: { gte: since } } }),
    ),
    sessionsWithGclid: await step("sessionsWithGclid", () =>
      prisma.userSession.count({ where: { createdAt: { gte: since }, gclid: { not: null } } }),
    ),
    sessionsWithUtmSource: await step("sessionsWithUtmSource", () =>
      prisma.userSession.count({ where: { createdAt: { gte: since }, utmSource: { not: null } } }),
    ),
    jobsTotal: await step("jobsTotal", () =>
      prisma.job.count({ where: { createdAt: { gte: since } } }),
    ),
    jobsWithGclid: await step("jobsWithGclid", () =>
      prisma.job.count({ where: { createdAt: { gte: since }, gclid: { not: null } } }),
    ),
    jobsCompleted: await step("jobsCompleted", () =>
      prisma.job.count({ where: { createdAt: { gte: since }, status: "COMPLETED" } }),
    ),
    jobsUploadStatuses: await step("jobsUploadStatuses", async () => {
      const rows = await prisma.job.findMany({
        where: { createdAt: { gte: since } },
        select: { conversionUploadStatus: true },
      });
      const counts: Record<string, number> = {};
      for (const r of rows) {
        const k = r.conversionUploadStatus ?? "(never_attempted)";
        counts[k] = (counts[k] || 0) + 1;
      }
      return counts;
    }),
    callIntentsTotal: await step("callIntentsTotal", () =>
      prisma.callIntent.count({ where: { createdAt: { gte: since } } }),
    ),
    callIntentsWithGclid: await step("callIntentsWithGclid", () =>
      prisma.callIntent.count({ where: { createdAt: { gte: since }, gclid: { not: null } } }),
    ),
    callIntentsMatchedToJob: await step("callIntentsMatchedToJob", () =>
      prisma.callIntent.count({ where: { createdAt: { gte: since }, jobId: { not: null } } }),
    ),
  };

  return NextResponse.json({ windowDays: 30, results });
}
