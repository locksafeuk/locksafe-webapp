/**
 * _funnel-diagnose.ts — READ ONLY
 * Task 7: locate where each job dies in the dispatch→quote→pay funnel.
 * No free-text cancel reason exists, so we infer the furthest stage reached
 * from which lifecycle timestamps are populated.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

function furthestStage(j: any, appsCount: number): string {
  if (j.assessmentPaid) return "9_paid";
  if (j.signedAt) return "8_signed";
  if (j.workCompletedAt) return "7_work_completed";
  if (j.workStartedAt) return "6_work_started";
  if (j.diagnosedAt) return "5_diagnosed";
  if (j.arrivedAt) return "4_arrived";
  if (j.enRouteAt) return "3_en_route";
  if (j.acceptedAt) return "2_accepted";
  if (appsCount > 0) return "1b_locksmith_applied_not_accepted";
  if (j.notifiedAt || (j.notifiedLocksmithIds?.length ?? 0) > 0) return "1a_dispatched_no_application";
  if (j.noLocksmithNotifiedAt) return "0b_no_locksmith_in_area";
  return "0a_created_never_dispatched";
}

(async () => {
  const jobs = await p.job.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, jobNumber: true, status: true, createdVia: true, problemType: true,
      propertyType: true, isEmergency: true, postcode: true, createdAt: true,
      notifiedAt: true, notifiedLocksmithIds: true, noLocksmithNotifiedAt: true,
      dispatchAttempts: true, locksmithId: true, acceptedAt: true, enRouteAt: true,
      arrivedAt: true, diagnosedAt: true, workStartedAt: true, workCompletedAt: true,
      signedAt: true, assessmentFee: true, assessmentPaid: true, utmSource: true,
      _count: { select: { applications: true, payments: true } },
    },
  });

  const stageCount: Record<string, number> = {};
  const stageByStatus: Record<string, Record<string, number>> = {};
  const rows: any[] = [];

  for (const j of jobs) {
    const apps = (j as any)._count.applications;
    const stage = furthestStage(j, apps);
    stageCount[stage] = (stageCount[stage] ?? 0) + 1;
    stageByStatus[j.status] = stageByStatus[j.status] ?? {};
    stageByStatus[j.status][stage] = (stageByStatus[j.status][stage] ?? 0) + 1;
    rows.push({
      job: j.jobNumber, status: j.status, via: j.createdVia, problem: j.problemType,
      emer: j.isEmergency, pc: j.postcode?.split(" ")[0], created: j.createdAt.toISOString().slice(0, 10),
      apps, notified: (j.notifiedLocksmithIds?.length ?? 0), dispatchWaves: j.dispatchAttempts,
      assigned: !!j.locksmithId, assessFee: j.assessmentFee, paid: j.assessmentPaid,
      diedAt: stage, src: j.utmSource ?? "—",
    });
  }

  console.log("\n===== FUNNEL DIAGNOSIS (read-only, all-time) =====");
  console.log("Total jobs:", jobs.length);
  console.log("\n--- Furthest stage reached (all jobs) ---");
  Object.entries(stageCount).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(36)} ${v}`));
  console.log("\n--- Stage by final status ---");
  console.log(JSON.stringify(stageByStatus, null, 2));
  console.log("\n--- Per-job ---");
  console.table(rows);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
