import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const missing: any = await (p as any).$runCommandRaw({
    count: 'Customer',
    query: { email: { $exists: false } },
  });
  const isNull: any = await (p as any).$runCommandRaw({
    count: 'Customer',
    query: { email: null },
  });
  console.log('Customers with email field MISSING:', missing.n);
  console.log('Customers with email field == null  :', isNull.n);

  const sample: any = await (p as any).$runCommandRaw({
    find: 'Customer',
    filter: {},
    projection: { email: 1, phone: 1, name: 1 },
    limit: 30,
  });
  console.log('\nSample:');
  for (const d of sample.cursor.firstBatch) {
    console.log(' ', d.name, '|', d.phone, '| email=', JSON.stringify(d.email));
  }
  await p.$disconnect();
})();
