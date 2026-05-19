/**
 * Audit: list locksmiths whose base coordinates fall outside the UK + Ireland
 * bounding box. Read-only — does NOT delete anything. Use the admin UI to
 * deactivate or delete the offenders.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UK_IE = { minLat: 49.0, maxLat: 61.0, minLng: -10.8, maxLng: 2.1 };

async function main() {
  const all = await prisma.locksmith.findMany({
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      baseLat: true,
      baseLng: true,
      baseAddress: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
    },
  });

  const offenders = all.filter((l) => {
    if (l.baseLat == null || l.baseLng == null) return false;
    return (
      l.baseLat < UK_IE.minLat ||
      l.baseLat > UK_IE.maxLat ||
      l.baseLng < UK_IE.minLng ||
      l.baseLng > UK_IE.maxLng
    );
  });

  const missing = all.filter((l) => l.baseLat == null || l.baseLng == null);

  console.log(`Total locksmiths: ${all.length}`);
  console.log(`Missing location: ${missing.length}`);
  console.log(`Outside UK + Ireland bounding box: ${offenders.length}\n`);

  if (offenders.length === 0) {
    console.log("No out-of-region locksmiths found.");
  } else {
    for (const l of offenders) {
      console.log(
        `  [${l.id}] ${l.name}${l.companyName ? ` (${l.companyName})` : ""} – ${l.email}`
      );
      console.log(
        `     ${l.baseLat?.toFixed(4)}, ${l.baseLng?.toFixed(4)} – ${l.baseAddress ?? "no address"}`
      );
      console.log(
        `     active=${l.isActive} verified=${l.isVerified} joined=${l.createdAt.toISOString().slice(0, 10)}`
      );
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
