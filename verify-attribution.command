#!/bin/bash
# Verify a Job actually carries UTM + gclid after a booking.
#
# Usage: pass a Job ID as argument, or omit to inspect the most recent
# Job created via the website. The script reads the DB directly and
# prints the attribution fields — proving the pipeline survived.
#
# Designed to run AFTER you've done a test booking with a tracked URL:
#   1. Open an incognito Chrome window
#   2. Visit https://www.locksafe.uk/?gclid=test_attribution_xxx
#               &utm_source=google&utm_medium=cpc
#               &utm_campaign=reading_emergency&utm_content=ad_a
#   3. Navigate to /request and submit a test booking
#   4. Run this command — see whether gclid + utm_campaign landed on the Job

set -e
cd "$(dirname "$0")"

JOB_ID="$1"

node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json -e "
import { prisma } from './src/lib/db';
(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  let job;
  const arg = process.argv[process.argv.length - 1];
  if (arg && arg.length === 24 && /^[a-f0-9]+\$/.test(arg)) {
    job = await p.job.findUnique({ where: { id: arg } });
    if (!job) { console.error('Job not found:', arg); process.exit(1); }
  } else {
    job = await p.job.findFirst({
      where: { createdVia: { in: ['web', 'app'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) { console.error('No recent web-created job found'); process.exit(1); }
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('Job:', job.jobNumber, '(' + job.id + ')');
  console.log('Created:', new Date(job.createdAt).toISOString());
  console.log('Postcode:', job.postcode);
  console.log('Status:', job.status);
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('Attribution fields:');
  const fields = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'gclid', 'fbclid', 'landingPage'];
  let anyPresent = false;
  for (const f of fields) {
    const v = job[f];
    if (v) { anyPresent = true; console.log('  \\x1b[32m✓\\x1b[0m', f.padEnd(14), '=', v); }
    else { console.log('  \\x1b[2m·\\x1b[0m', f.padEnd(14), '= (null)'); }
  }
  console.log('');
  console.log('Conversion upload state:');
  console.log('  conversionUploadStatus:', job.conversionUploadStatus ?? '(not attempted)');
  if (job.conversionUploadedAt) {
    console.log('  uploadedAt:', new Date(job.conversionUploadedAt).toISOString());
  }
  if (job.conversionUploadError) {
    console.log('  error:', job.conversionUploadError);
  }
  console.log('');
  if (anyPresent) {
    console.log('\\x1b[32m✓ attribution captured — pipeline working\\x1b[0m');
  } else {
    console.log('\\x1b[33m! no attribution data on this Job\\x1b[0m');
    console.log('  This is normal for direct-traffic jobs (no UTM in URL).');
    console.log('  For a real attribution test, do a booking with utm_* params + gclid in the URL.');
  }
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
" "$JOB_ID"

echo ""
read -p "press enter to close..."
