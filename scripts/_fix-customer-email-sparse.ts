import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  console.log('Dropping non-sparse Customer_email_key...');
  try {
    const drop: any = await (p as any).$runCommandRaw({
      dropIndexes: 'Customer',
      index: 'Customer_email_key',
    });
    console.log('  drop result:', JSON.stringify(drop));
  } catch (e: any) {
    console.log('  drop error (may already be gone):', e.message?.slice(0, 200));
  }

  console.log('Creating sparse unique index on email...');
  const create: any = await (p as any).$runCommandRaw({
    createIndexes: 'Customer',
    indexes: [{
      key: { email: 1 },
      name: 'Customer_email_key',
      unique: true,
      sparse: true,
    }],
  });
  console.log('  create result:', JSON.stringify(create));

  // Verify
  const ix: any = await (p as any).$runCommandRaw({ listIndexes: 'Customer' });
  for (const idx of ix.cursor?.firstBatch || []) {
    if (idx.key?.email !== undefined) console.log('  VERIFIED:', JSON.stringify(idx));
  }
  await p.$disconnect();
})();
