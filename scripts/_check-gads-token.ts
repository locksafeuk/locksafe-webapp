import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const cfg: any = await p.googleAdsApiConfig.findFirst();
  const t = cfg.developerToken || '';
  console.log('DB developerToken length:', t.length);
  console.log('DB token prefix:', t.slice(0,4), 'suffix:', t.slice(-4));
  console.log('ENV GOOGLE_ADS_DEVELOPER_TOKEN length:', (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').length);
  const e = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  console.log('ENV token prefix:', e.slice(0,4), 'suffix:', e.slice(-4));
  console.log('Match?:', t === e);
  await p.$disconnect();
})();
