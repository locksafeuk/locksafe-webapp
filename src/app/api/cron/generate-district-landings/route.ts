/**
 * District Landing Page Generation Cron
 *
 * Runs nightly. For every district that has active LocksmithCoverage rows,
 * calls ensureOrSkip — which creates a new page if missing, regenerates a
 * stale or needs_refresh page, and silently reuses anything fresh.
 * manual_override pages are always left untouched.
 *
 * Schedule: 0 2 * * * (02:00 UTC daily)
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma as _prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { ensureOrSkip } from "@/lib/district-landing/ensure-landing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const DISTRICT_TIMEOUT_MS = Number(process.env["DISTRICT_LANDING_TIMEOUT_MS"] ?? "45000");
const MAX_RUNTIME_MS = Number(process.env["DISTRICT_LANDING_MAX_RUNTIME_MS"] ?? "240000");

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  // ── 1. Find all districts with at least one unpaused coverage row ───
  const coverageRows: Array<{ postcodeDistrict: string }> =
    await prisma.locksmithCoverage.findMany({
      where:    { isPaused: false },
      select:   { postcodeDistrict: true },
      distinct: ["postcodeDistrict"],
      orderBy:  { postcodeDistrict: "asc" },
    });

  const districts = coverageRows.map((r: { postcodeDistrict: string }) =>
    r.postcodeDistrict.trim().toUpperCase(),
  );

  if (districts.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No covered districts found",
      durationMs: Date.now() - start,
    });
  }

  // ── 2. Run ensureOrSkip for every district ──────────────────────────
  // Concurrency is intentionally serial: each call hits Ollama (GPU-bound)
  // and we don't want to saturate the model server or race on DB upserts.
  const summary = {
    total:       districts.length,
    created:     0,
    regenerated: 0,
    reused:      0,
    keptManual:  0,
    skipped:     0,
    errors:      0,
    timedOut:    0,
    remaining:   0,
  };

  const errorLog: Array<{ district: string; error: string }> = [];
  let truncated = false;

  for (const district of districts) {
    if ((Date.now() - start) >= MAX_RUNTIME_MS) {
      truncated = true;
      break;
    }

    try {
      const result = await withTimeout(
        ensureOrSkip(district),
        DISTRICT_TIMEOUT_MS,
        `ensureOrSkip(${district})`,
      );

      if (!result.ok) {
        summary.skipped++;
        continue;
      }

      switch (result.result?.action) {
        case "created":     summary.created++;     break;
        case "regenerated": summary.regenerated++;  break;
        case "reused":      summary.reused++;       break;
        case "kept_manual": summary.keptManual++;   break;
        default:            summary.reused++;       break;
      }
    } catch (err) {
      summary.errors++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (/timed out after/i.test(errorMessage)) summary.timedOut++;
      errorLog.push({
        district,
        error: errorMessage,
      });
    }
  }

  if (truncated) {
    const handled =
      summary.created +
      summary.regenerated +
      summary.reused +
      summary.keptManual +
      summary.skipped +
      summary.errors;
    summary.remaining = Math.max(0, summary.total - handled);
  }

  const durationMs = Date.now() - start;

  console.log(
    `[district-landings cron] ${summary.created} created, ` +
    `${summary.regenerated} regenerated, ${summary.reused} reused, ` +
    `${summary.keptManual} manual, ${summary.skipped} skipped, ` +
    `${summary.errors} errors (${summary.timedOut} timeouts), ` +
    `${summary.remaining} remaining — ${durationMs}ms`,
  );

  return NextResponse.json({
    success: true,
    truncated,
    summary,
    errors:  errorLog.length > 0 ? errorLog : undefined,
    durationMs,
    limits: {
      DISTRICT_TIMEOUT_MS,
      MAX_RUNTIME_MS,
    },
  });
}
