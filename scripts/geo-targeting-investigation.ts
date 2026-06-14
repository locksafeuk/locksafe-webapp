import { getDefaultGoogleAdsClient } from '../src/lib/google-ads';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('===== STEP 1: GOOGLE ADS — ALL campaign geo settings =====');
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error('no client');
  const settings = await ctx.client.query(
    'SELECT campaign.id, campaign.name, campaign.status, ' +
    'campaign.geo_target_type_setting.positive_geo_target_type, ' +
    'campaign.geo_target_type_setting.negative_geo_target_type ' +
    'FROM campaign WHERE campaign.status IN (ENABLED, PAUSED)'
  );
  console.log(JSON.stringify(settings, null, 2));

  console.log('\n===== STEP 2: RECENT JOBS (30d) — postcode + gclid + utmSource =====');
  const recentJobs = await (prisma as any).job.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    select: { jobNumber: true, postcode: true, gclid: true, msclkid: true, utmSource: true, utmCampaign: true, createdVia: true, createdAt: true, firstTouchSource: true, firstTouchGclid: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('jobNumber  | pcfx | createdVia | attribution');
  for (const j of recentJobs) {
    const pcPrefix = (j.postcode || '').toUpperCase().split(' ')[0];
    const attrib = j.gclid ? 'GCLID' : (j.firstTouchGclid ? 'firstTouchGclid' : (j.utmSource || 'no_attrib'));
    console.log((j.jobNumber || '').padEnd(11) + ' | ' + pcPrefix.padEnd(5) + ' | ' + (j.createdVia || '?').padEnd(10) + ' | ' + attrib);
  }

  console.log('\n===== STEP 3: POSTCODE BUCKETS =====');
  const buckets: Record<string, number> = {};
  const bucketsWithGclid: Record<string, number> = {};
  let total = 0;
  let withGclid = 0;
  for (const j of recentJobs) {
    const pc = (j.postcode || 'UNKNOWN').toUpperCase().split(' ')[0];
    buckets[pc] = (buckets[pc] || 0) + 1;
    if (j.gclid || j.firstTouchGclid) {
      bucketsWithGclid[pc] = (bucketsWithGclid[pc] || 0) + 1;
      withGclid++;
    }
    total++;
  }
  const sorted = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  console.log('postcode | total | with_gclid');
  for (const [pc, n] of sorted) {
    const g = bucketsWithGclid[pc] || 0;
    console.log('  ' + pc.padEnd(8) + ' | ' + String(n).padStart(5) + ' | ' + String(g).padStart(10));
  }
  console.log('TOTAL: ' + total + ' jobs, ' + withGclid + ' with gclid (' + (100 * withGclid / Math.max(1, total)).toFixed(0) + '%)');
}

main().then(() => (prisma as any).$disconnect()).catch(async (e) => { console.error(e); await (prisma as any).$disconnect(); process.exit(1); });
