import * as path from "path";
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});
import { prisma as _prisma } from "../src/lib/db";
const prisma = _prisma as any;

async function main() {
  const jobs = await prisma.job.findMany({
    where: { status: "COMPLETED" },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true, status: true, gclid: true,
      conversionUploadStatus: true, conversionUploadedAt: true, conversionUploadError: true,
      updatedAt: true,
      customer: { select: { name: true } },
    },
  });
  console.log("\nLast 10 COMPLETED jobs — conversion-upload state:\n");
  console.table(jobs.map((j: any) => ({
    id: j.id.slice(-6),
    customer: (j.customer?.name ?? "").slice(0, 18),
    gclid: j.gclid ? "yes" : "—",
    convStatus: j.conversionUploadStatus ?? "—",
    uploadedAt: j.conversionUploadedAt ? new Date(j.conversionUploadedAt).toISOString().slice(0,19) : "—",
    err: (j.conversionUploadError ?? "").slice(0, 40),
    updatedAt: new Date(j.updatedAt).toISOString().slice(0,19),
  })));

  const uploaded = jobs.filter((j: any) => j.conversionUploadStatus === "uploaded").length;
  const failed   = jobs.filter((j: any) => j.conversionUploadStatus === "failed" || j.conversionUploadStatus === "error").length;
  const skipped  = jobs.filter((j: any) => j.conversionUploadStatus === "skipped_no_gclid").length;
  const pending  = jobs.filter((j: any) => !j.conversionUploadStatus).length;
  console.log(`\nSummary (last 10 completed): uploaded=${uploaded}  failed=${failed}  skipped_no_gclid=${skipped}  no-status=${pending}\n`);

  if (uploaded > 0) console.log("✅ Conversion upload has fired successfully in production. Gate CLEARED.");
  else if (failed > 0) console.log("❌ Upload attempted but failed — see 'err' column above. Likely env or auth issue.");
  else if (skipped === jobs.length) console.log("ℹ️  All recent jobs lack a gclid — complete one from a Google-Ads-tagged booking to test.");
  else console.log("⚠️  No jobs are 'uploaded' yet. Complete + Stripe-pay a GCLID-tagged booking to verify.");

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
