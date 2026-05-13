const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

function parseLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

async function main() {
  console.log('Connecting to MongoDB...');
  const csvPath = path.join(process.cwd(), 'data/locksmith-leads.csv');
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n').slice(1);
  console.log('CSV rows to process:', lines.length);
  let saved = 0, skipped = 0;
  for (const line of lines) {
    const [name, email, phone, city, address, website, rating, reviews, placeId] = parseLine(line);
    if (!placeId || !placeId.trim()) continue;
    try {
      await prisma.locksmithLead.upsert({
        where: { googlePlaceId: placeId.trim() },
        update: {},
        create: {
          googlePlaceId: placeId.trim(),
          name: name || '',
          city: city || '',
          address: address || '',
          phone: phone || null,
          website: website || null,
          email: email || null,
          rating: parseFloat(rating) || 0,
          reviewCount: parseInt(reviews) || 0,
        }
      });
      saved++;
    } catch(e) {
      skipped++;
    }
  }
  console.log('Saved:', saved, '| Skipped:', skipped);
  const total = await prisma.locksmithLead.count();
  const withEmail = await prisma.locksmithLead.count({ where: { email: { not: null } } });
  console.log('Total in DB:', total, '| With email:', withEmail);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
