import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  const csv = fs.readFileSync('data/locksmith-leads.csv', 'utf-8');
  const lines = csv.trim().split('\n');
  let saved = 0, skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const [name, email, phone, city, address, website, rating, reviews, googlePlaceId] = cols;
    if (!googlePlaceId || !googlePlaceId.trim()) continue;
    try {
      await prisma.locksmithLead.upsert({
        where: { googlePlaceId: googlePlaceId.trim() },
        update: {},
        create: {
          googlePlaceId: googlePlaceId.trim(),
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
    } catch (e: unknown) {
      skipped++;
    }
  }

  console.log(`Saved: ${saved} | Skipped: ${skipped}`);
  const total = await prisma.locksmithLead.count();
  const withEmail = await prisma.locksmithLead.count({ where: { email: { not: null } } });
  console.log(`Total in DB: ${total} | With email: ${withEmail}`);
  await prisma.$disconnect();
}

main().catch(console.error);
