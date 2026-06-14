import { computeCoverageMap } from '../src/lib/campaign-coverage-builder';
async function main() {
  const cov = await computeCoverageMap();
  for (const cityName of ['stockport', 'leeds', 'liverpool', 'newcastle', 'bradford']) {
    const entry = cov.entries.find((e) => e.cityName === cityName);
    if (!entry) { console.log(cityName + ': not in map'); continue; }
    console.log('=== ' + cityName + ' (geo ' + entry.geoId + ') eligible=' + entry.eligible + ' count=' + entry.locksmithCount + ' ===');
    console.log('  first covering point:', JSON.stringify(entry.covering[0]));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
