#!/bin/bash
# Query the latest UserSession for the test visitor and prove the
# attribution capture pipeline worked end-to-end.
set -e
cd "$(dirname "$0")"

VISITOR_ID="${1:-v_1777094714458_tz05e1d0kr}"

node_modules/.bin/ts-node -r tsconfig-paths/register \
  --project tsconfig.scripts.json -e "
import { prisma } from './src/lib/db';
(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = prisma as any;
  const sessions = await p.userSession.findMany({
    where:   { visitorId: '$VISITOR_ID' },
    orderBy: { lastActiveAt: 'desc' },
    take:    3,
  });
  if (sessions.length === 0) {
    console.log('No UserSession found for visitor', '$VISITOR_ID');
    process.exit(1);
  }
  console.log('');
  console.log('Found', sessions.length, 'session(s) for', '$VISITOR_ID');
  console.log('');
  for (const s of sessions.slice(0, 3)) {
    console.log('═══════════════════════════════════════════');
    console.log('Session:', s.id);
    console.log('Started:', new Date(s.startedAt).toISOString());
    console.log('Last active:', new Date(s.lastActiveAt).toISOString());
    console.log('Landing page:', s.landingPage);
    console.log('');
    console.log('Attribution:');
    const fields = ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'gclid', 'fbclid'];
    for (const f of fields) {
      const v = s[f];
      if (v) console.log('  \\x1b[32m✓\\x1b[0m', f.padEnd(13), '=', v);
      else   console.log('  \\x1b[2m·\\x1b[0m', f.padEnd(13), '= (null)');
    }
    console.log('');
  }
  const latest = sessions[0];
  const hasTest = latest.gclid === 'test_attribution_2026'
    && latest.utmCampaign === 'attribution_pipeline_test';
  if (hasTest) {
    console.log('\\x1b[32m✓ pipeline proven — gclid + utmCampaign landed correctly\\x1b[0m');
  } else {
    console.log('\\x1b[33m! latest session doesn\\'t have the test params — page may not have fired session POST yet\\x1b[0m');
  }
})().catch((e) => { console.error('ERR:', e.message); process.exit(1); });
"

echo ""
read -p "press enter to close..."
