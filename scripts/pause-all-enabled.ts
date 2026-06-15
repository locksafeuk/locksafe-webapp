import { getDefaultGoogleAdsClient } from '../src/lib/google-ads';

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error('no client');
  const { client, customerId } = ctx;

  console.log('===== STEP 1: find ENABLED campaigns =====');
  const enabled = await client.query(
    'SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status = ENABLED'
  );
  if (!Array.isArray(enabled) || enabled.length === 0) {
    console.log('No ENABLED campaigns — already paused.');
    return;
  }
  for (const r of (enabled as any[])) {
    console.log('  ENABLED: ' + r.campaign.id + ' ' + r.campaign.name);
  }

  console.log('\n===== STEP 2: pause via campaigns:mutate (status=PAUSED) =====');
  // Use raw REST POST via client.query? No — need a mutate. The GoogleAdsClient may not expose mutate
  // Inspect the prototype to find a mutate or rawRequest function.
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(client));
  console.log('client methods: ' + proto.join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
