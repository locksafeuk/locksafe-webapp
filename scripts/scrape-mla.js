/**
 * scrape-mla.js
 *
 * Scrapes MLA (Master Locksmiths Association) directory.
 * Strategy: Hit each region/subregion page, parse TownPageLocksmiths__griditem
 * cards which contain name, address, phone, and data-locksmith-email (plain text).
 *
 * Usage (from project root):
 *   DATABASE_URL="mongodb+srv://..." node scripts/scrape-mla.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// All region/subregion pages that use the TownPageLocksmiths card layout
const PAGES = [
  { url: 'https://www.locksmiths.co.uk/london/', region: 'London' },
  { url: 'https://www.locksmiths.co.uk/locksmith-north-east/', region: 'North East England' },
  { url: 'https://www.locksmiths.co.uk/locksmith-north-west/', region: 'North West England' },
  { url: 'https://www.locksmiths.co.uk/yorkshire-the-humber/', region: 'Yorkshire' },
  { url: 'https://www.locksmiths.co.uk/east-midlands/', region: 'East Midlands' },
  { url: 'https://www.locksmiths.co.uk/west-midlands/', region: 'West Midlands' },
  { url: 'https://www.locksmiths.co.uk/locksmith-east-england/', region: 'East England' },
  { url: 'https://www.locksmiths.co.uk/south-east/', region: 'South East England' },
  { url: 'https://www.locksmiths.co.uk/south-west/', region: 'South West England' },
  { url: 'https://www.locksmiths.co.uk/locksmith-wales/', region: 'Wales' },
  { url: 'https://www.locksmiths.co.uk/locksmith-north-wales/', region: 'North Wales' },
  { url: 'https://www.locksmiths.co.uk/locksmith-south-wales/', region: 'South Wales' },
  { url: 'https://www.locksmiths.co.uk/scotland/', region: 'Scotland' },
  { url: 'https://www.locksmiths.co.uk/northern-ireland/', region: 'Northern Ireland' },
  { url: 'https://www.locksmiths.co.uk/ireland/', region: 'Ireland' },
  { url: 'https://www.locksmiths.co.uk/locksmith-jersey/', region: 'Jersey' },
  // Also try the main alphabetical listing page 1 for any extras
  { url: 'https://www.locksmiths.co.uk/find-a-locksmith/', region: 'UK' },
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchHtml(url) {
  const { exec } = require('child_process');
  return new Promise((resolve) => {
    const cmd = `curl -s --max-time 30 --http1.1 "${url}" `
      + `-H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36" `
      + `-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" `
      + `-H "Accept-Language: en-GB,en;q=0.5"`;
    exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      resolve(err ? '' : stdout);
    });
  });
}

/**
 * Extract city from a UK address string.
 * e.g. "137 Wood Street, Walthamstow, London, E17 3LX" → "London"
 */
function extractCity(address) {
  if (!address) return null;
  // Remove trailing postcode
  const noPost = address.replace(/,?\s*[A-Z]{1,2}\d{1,2}\s+\d[A-Z]{2}\s*$/i, '').trim();
  const parts = noPost.split(',').map(p => p.trim()).filter(Boolean);
  // Last meaningful part is usually the town/city
  return parts.length >= 2 ? parts[parts.length - 1] : parts[0] || null;
}

/**
 * Parse TownPageLocksmiths__griditem cards from an MLA region/city page.
 * Each card is a <li class="TownPageLocksmiths__griditem ..."> element.
 *
 * Card contains:
 *   - <h2>Name</h2>
 *   - <p>Address</p>
 *   - <a href="tel:PHONE">
 *   - data-locksmith-email="EMAIL" (plain text, no entity encoding)
 *   - <a href="https://...find-a-locksmith/SLUG/">  (profile URL)
 *   - <a href="https://www.WEBSITE.co.uk/">  (website, optional)
 */
function parseCards(html, defaultRegion) {
  const entries = [];
  const cardSplitter = 'class="TownPageLocksmiths__griditem ';
  const blocks = html.split(cardSplitter);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // Name: <h2>Name</h2>
    const nameM = block.match(/<h2>([^<]+)<\/h2>/);
    if (!nameM) continue;
    const name = nameM[1].trim();
    if (!name) continue;

    // Email: data-locksmith-email="EMAIL"
    const emailM = block.match(/data-locksmith-email="([^"@\s]+@[^"@\s]+)"/);
    const email = emailM ? emailM[1].toLowerCase().trim() : null;

    // Phone: href="tel:PHONE" — first tel: link in the block
    const phoneM = block.match(/href="tel:([^"]+)"/);
    const phone = phoneM ? phoneM[1].trim() : null;

    // Profile URL: href="https://www.locksmiths.co.uk/find-a-locksmith/SLUG/"
    const profileM = block.match(/href="(https:\/\/www\.locksmiths\.co\.uk\/find-a-locksmith\/[a-z0-9-]+\/)"/);
    const profileUrl = profileM ? profileM[1] : null;
    // Use slug as unique key
    const slugM = profileUrl ? profileUrl.match(/\/find-a-locksmith\/([a-z0-9-]+)\/$/) : null;
    const slug = slugM ? slugM[1] : null;

    // Address: first <p>TEXT</p> that looks like an address (contains comma + postcode)
    const addressM = block.match(/<p>([^<]{10,})<\/p>/);
    const address = addressM ? addressM[1].trim() : '';

    // Website: find ">Website<" or ">Website " first, then look back for external href
    let website = null;
    const websiteIdx = block.indexOf('>Website<');
    if (websiteIdx > 0) {
      const near = block.slice(Math.max(0, websiteIdx - 300), websiteIdx);
      const wM = near.match(/href="(https?:\/\/(?!www\.locksmiths\.co\.uk)[^"]+)"/);
      if (wM) website = wM[1];
    }

    // City from address, fallback to "covering" span, fallback to region
    const coveringM = block.match(/<span>Locksmith covering ([^<]+)<\/span>/);
    const coveringCity = coveringM ? coveringM[1].trim() : null;
    const city = extractCity(address) || coveringCity || defaultRegion;

    entries.push({ name, email, phone, address, city, profileUrl, website, slug });
  }
  return entries;
}

async function main() {
  console.log('🏛️  Scraping MLA (Master Locksmiths Association) directory...\n');

  const seenSlugs = new Set();
  const seenNames = new Set();
  const all = [];

  for (const page of PAGES) {
    process.stdout.write(`📍 ${page.region} (${page.url.replace('https://www.locksmiths.co.uk', '')})... `);
    const html = await fetchHtml(page.url);
    if (!html) { console.log('⚠ failed'); continue; }

    const cards = parseCards(html, page.region);
    let newCount = 0;

    for (const card of cards) {
      // Deduplicate by slug first, then by name
      const key = card.slug || card.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (seenSlugs.has(key) || seenNames.has(card.name.toLowerCase())) continue;
      seenSlugs.add(key);
      seenNames.add(card.name.toLowerCase());
      all.push(card);
      newCount++;
    }

    console.log(`${cards.length} cards, ${newCount} new`);
    await sleep(700);
  }

  console.log(`\n✨  Total MLA locksmiths: ${all.length}`);
  console.log(`    With email: ${all.filter(e => e.email).length}`);
  console.log(`    With phone: ${all.filter(e => e.phone).length}`);

  // Print sample
  console.log('\nSample (first 5):');
  all.slice(0, 5).forEach(e => {
    console.log(`  ${e.name} | ${e.city} | ${e.phone || '-'} | ${e.email || 'no email'}`);
  });

  // --- Save to DB ---
  console.log('\n💾  Saving to database...');
  let saved = 0, updated = 0, failed = 0;

  for (const entry of all) {
    try {
      const uniqueKey = `mla-${entry.slug || entry.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      await prisma.locksmithLead.upsert({
        where: { googlePlaceId: uniqueKey },
        update: {
          ...(entry.email && { email: entry.email }),
          ...(entry.phone && { phone: entry.phone }),
          ...(entry.address && { address: entry.address }),
          notes: 'MLA Approved Locksmith',
        },
        create: {
          googlePlaceId: uniqueKey,
          name: entry.name,
          city: entry.city,
          address: entry.address || '',
          phone: entry.phone || null,
          email: entry.email || null,
          website: entry.website || entry.profileUrl || null,
          rating: 0,
          reviewCount: 0,
          status: 'new',
          notes: 'MLA Approved Locksmith',
        },
      });
      saved++;
    } catch (e) {
      failed++;
      if (process.env.DEBUG) console.error('  DB error:', e.message, entry.name);
    }
  }

  console.log(`✅  DB: ${saved} upserted, ${failed} failed`);

  const total = await prisma.locksmithLead.count();
  const withEmail = await prisma.locksmithLead.count({ where: { email: { not: null } } });
  const mlaCount = await prisma.locksmithLead.count({ where: { notes: 'MLA Approved Locksmith' } });
  console.log(`\n📊  Total leads in DB: ${total}`);
  console.log(`    MLA leads: ${mlaCount} | With email: ${withEmail}`);

  await prisma.$disconnect();
  console.log('\n🎉  MLA scrape complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
