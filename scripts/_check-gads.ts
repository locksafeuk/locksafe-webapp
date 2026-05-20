import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const cfg: any = await p.googleAdsApiConfig.findFirst();
  if (!cfg) { console.log('NO CONFIG ROW'); await p.$disconnect(); return; }
  console.log('Config:', {
    id: cfg.id,
    customerId: cfg.customerId,
    loginCustomerId: cfg.loginCustomerId,
    redirectUri: cfg.redirectUri,
    hasDevToken: !!cfg.developerToken,
    hasClientId: !!cfg.oauthClientId,
    hasClientSecret: !!cfg.oauthClientSecret,
    hasRefreshToken: !!cfg.refreshToken,
    refreshTokenLen: (cfg.refreshToken || '').length,
    updatedAt: cfg.updatedAt,
  });
  try {
    const acct: any[] = await (p as any).googleAdsAccount.findMany();
    console.log('Accounts:', acct.map(a => ({
      customerId: a.customerId,
      name: a.name,
      hasRefreshToken: !!a.refreshToken,
      refreshTokenLen: (a.refreshToken || '').length,
    })));
  } catch (e: any) {
    console.log('No GoogleAdsAccount model:', e.message?.slice(0, 100));
  }
  await p.$disconnect();
})();
