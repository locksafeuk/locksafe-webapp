/* eslint-disable */
import { PrismaClient } from "@prisma/client";
import { enforceDraftGuardrails } from "../src/lib/google-ads-draft-enforcement";

const prisma = new PrismaClient();

const RSA = (label: string, group: string) => ([{ name: label + ' RSA - ' + group }]);

const headlinesShared = [
  'Locked Out in Liverpool?',
  'Non-Destructive Entry First',
  'Back Inside in 30 Minutes',
  '24/7 Lockout Response',
  'Anti-Fraud Booking Guarantee',
  'Full Price Agreed Upfront',
  'Vetted & Insured Specialists',
  'GPS-Tracked to Your Door',
  'Money-Back Guarantee',
  'DBS Checked Tradesmen',
  'Book in 60 Seconds',
  'LockSafe — Fraud-Protected',
  'See Prices Before You Book',
  'Fixed Price Entry',
];
const descriptionsShared = [
  'Vetted specialist on-site in 30 min. Full price agreed before work starts.',
  'Anti-fraud protection. See the quote first, then accept or decline.',
  'DBS-checked, GPS-tracked & insured. Local Liverpool lockout experts.',
  '24/7 service. Transparent pricing guaranteed. Book in 60 seconds.',
];

function agSpec(name: string, customH1: string, keywords: any[]) {
  const h = [customH1, ...headlinesShared.slice(1)];
  return { name, keywords, headlines: h, descriptions: descriptionsShared, ads: [{ name: name + ' Primary RSA' }] };
}

const adGroups = [
  agSpec('Locked Out', 'Locked Out in Liverpool?', [
    { text: 'locked out of house', matchType: 'EXACT' },
    { text: 'locked out of my house', matchType: 'EXACT' },
    { text: 'locked out of flat', matchType: 'EXACT' },
    { text: 'house lockout', matchType: 'EXACT' },
    { text: 'flat lockout', matchType: 'EXACT' },
    { text: 'locked out', matchType: 'PHRASE' },
    { text: 'locked out liverpool', matchType: 'PHRASE' },
    { text: 'locked out merseyside', matchType: 'PHRASE' },
    { text: 'lockout liverpool', matchType: 'PHRASE' },
    { text: 'lockout merseyside', matchType: 'PHRASE' },
  ]),
  agSpec('Emergency & 24hr', 'Urgent Liverpool Lockout?', [
    { text: 'emergency lockout', matchType: 'EXACT' },
    { text: '24 hour lockout', matchType: 'EXACT' },
    { text: '24/7 lockout', matchType: 'EXACT' },
    { text: 'out of hours lockout', matchType: 'PHRASE' },
    { text: 'urgent lockout', matchType: 'PHRASE' },
    { text: 'emergency lockout liverpool', matchType: 'PHRASE' },
    { text: 'weekend lockout', matchType: 'PHRASE' },
    { text: 'midnight lockout', matchType: 'PHRASE' },
    { text: 'lockout help liverpool', matchType: 'PHRASE' },
    { text: 'lockout response l1', matchType: 'PHRASE' },
  ]),
  agSpec('Lock Change', 'Lock Change in Liverpool', [
    { text: 'lock change', matchType: 'EXACT' },
    { text: 'door lock replacement', matchType: 'EXACT' },
    { text: 'broken lock repair', matchType: 'EXACT' },
    { text: 'key snapped in lock', matchType: 'EXACT' },
    { text: 'key broke in lock', matchType: 'EXACT' },
    { text: 'front door lock change', matchType: 'PHRASE' },
    { text: 'back door lock change', matchType: 'PHRASE' },
    { text: 'door lock repair', matchType: 'PHRASE' },
    { text: 'lock change liverpool', matchType: 'PHRASE' },
    { text: 'door lock change liverpool', matchType: 'PHRASE' },
  ]),
  agSpec('uPVC & Burglary Repair', 'uPVC Lock Repair Liverpool', [
    { text: 'uPVC door lock repair', matchType: 'EXACT' },
    { text: 'uPVC door lock change', matchType: 'EXACT' },
    { text: 'anti-snap lock fitting', matchType: 'EXACT' },
    { text: 'burglary lock repair', matchType: 'EXACT' },
    { text: 'door secure after break in', matchType: 'PHRASE' },
    { text: 'broken in door repair', matchType: 'PHRASE' },
    { text: 'uPVC door lock replacement', matchType: 'PHRASE' },
    { text: 'burglary repair liverpool', matchType: 'PHRASE' },
    { text: 'anti-snap upgrade liverpool', matchType: 'PHRASE' },
    { text: 'uPVC repair l1', matchType: 'PHRASE' },
  ]),
  agSpec('Trust & USP', 'Vetted Liverpool Tradesmen', [
    { text: 'vetted lockout specialist', matchType: 'PHRASE' },
    { text: 'DBS checked tradesman lockout', matchType: 'PHRASE' },
    { text: 'fixed price lock change', matchType: 'PHRASE' },
    { text: 'transparent lockout pricing', matchType: 'PHRASE' },
    { text: 'insured lock specialist', matchType: 'PHRASE' },
    { text: 'GPS tracked lockout', matchType: 'PHRASE' },
    { text: '30 minute lockout response', matchType: 'PHRASE' },
    { text: 'anti fraud lockout booking', matchType: 'PHRASE' },
    { text: 'see price before booking lockout', matchType: 'PHRASE' },
    { text: 'upfront quote door lock', matchType: 'PHRASE' },
  ]),
];

const flatKeywords = adGroups.flatMap((g: any) => g.keywords);

const negativeKeywords = [
  'free','how to','diy','youtube','tutorial','yourself','video','reddit','forum','wikipedia',
  'course','training','apprentice','apprenticeship','salary','indeed','reed','totaljobs','glassdoor','jobs','job','career',
  'how much do','how much does','how much to','cost of','cost to','price of','price to','average cost','average price',
  'cheap','cheapest','discount','voucher','coupon','groupon','wowcher','free quote',
  'locksmith near me','near me locksmith',
  'key cutter','key cutting','key duplicator','key copy','key copying','key fob',
  'car key','car keys','car locksmith','auto locksmith','automotive locksmith','ignition key','transponder key','smart key','keyless entry','remote key',
  'safe locksmith','vault locksmith','safe opening','safe cracking','safe repair','safe installation','gun safe',
  'padlock','bike lock','suitcase lock','shed lock','garage door','gate lock','electric gate',
  'yale','chubb','banham','avocet','era','mul-t-lock','ultion','abus','squire','ingersoll','schlage','nuki','august smart','smart lock','yale connect','yale conexis','yale assure','yale doorman',
  'upvc window','window lock','casement lock','sash lock','mortice lock','deadbolt only','euro cylinder only',
  'checkatrade','trustpilot','trustatrader','my builder','rated people','mumsnet',
  'london','manchester','birmingham','glasgow','edinburgh','belfast','cardiff','leeds','newcastle','bristol','sheffield','nottingham','southampton','portsmouth','brighton','oxford','cambridge',
  'usa','america','american','new york','florida','california','australia','india','dubai',
  'scam','fake','fraud','rogue','watchdog',
  'no call out fee','no callout fee','nothing to pay','free callout','free call out',
  'locksmith rapper','locksmith film','locksmith movie','locksmith song','locksmith album',
  'porn','adult','sex',
];

async function main() {
  const account = await (prisma as any).googleAdsAccount.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!account) throw new Error('No active GoogleAdsAccount');
  const draftData = {
    accountId: account.id,
    name: 'LockSafe | Liverpool L1 v2 | §41 Multi-Group ' + new Date().toISOString().slice(0,10),
    status: 'DRAFT' as const,
    dailyBudget: 80,
    biddingStrategy: 'MAXIMIZE_CLICKS',
    targetCpa: null,
    channel: 'SEARCH',
    geoTargets: ['1006515'],
    languageTargets: ['1000'],
    geoExclusions: [],
    locationMatchType: 'PRESENCE',
    finalUrl: 'https://www.locksafe.uk/locksmith-in/l1',
    headlines: headlinesShared,
    descriptions: descriptionsShared,
    pinnedHeadlines: {},
    keywords: flatKeywords,
    negativeKeywords,
    adGroups,
    assets: [{ type: 'CALL', phoneNumber: '+442045771989' }],
    aiGenerated: false,
    aiPrompt: null,
    createdBy: 'admin' as const,
    createdByAdminId: null,
  };
  console.log('=== ENFORCEMENT ===');
  const result = enforceDraftGuardrails(draftData);
  if (!result.ok) {
    console.log('FAILED:');
    for (const v of result.violations) console.log('  - ' + v.field + ': ' + v.actual + ' (expected ' + v.expected + ')');
    process.exit(1);
  }
  console.log('OK. AppliedFixes: ' + result.appliedFixes.length);
  for (const f of result.appliedFixes) console.log('  - ' + f.field + ': ' + f.actual + ' -> ' + f.expected);
  console.log('=== PERSIST ===');
  const created = await (prisma as any).googleAdsCampaignDraft.create({ data: result.data });
  console.log('DRAFT ID: ' + created.id);
  console.log('NAME: ' + created.name);
  console.log('STATUS: ' + created.status);
  console.log('adGroups: ' + (Array.isArray(created.adGroups) ? created.adGroups.length : 0));
  console.log('keywords flat: ' + (Array.isArray(created.keywords) ? created.keywords.length : 0));
  console.log('negatives: ' + (Array.isArray(created.negativeKeywords) ? created.negativeKeywords.length : 0));
  console.log('assets: ' + JSON.stringify(created.assets));
  console.log('budget: £' + created.dailyBudget + '/day');
  console.log('bidding: ' + created.biddingStrategy);
  console.log('geo: ' + JSON.stringify(created.geoTargets));
  console.log('locationMatchType: ' + created.locationMatchType);
  console.log('finalUrl: ' + created.finalUrl);
  await (prisma as any).$disconnect();
}
main().catch(async (e) => { console.error(e); await (prisma as any).$disconnect(); process.exit(1); });
