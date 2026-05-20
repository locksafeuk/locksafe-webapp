import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const account: any = await p.googleAdsAccount.findFirst({ where: { isActive: true } });
  const cfg: any = await p.googleAdsApiConfig.findFirst();
  console.log('Testing refresh exchange...');
  console.log('  customerId:', account.customerId);
  console.log('  refreshToken prefix:', String(account.refreshToken).slice(0, 12) + '...');
  console.log('  clientId set:', !!cfg.oauthClientId);

  const body = new URLSearchParams({
    client_id: cfg.oauthClientId,
    client_secret: cfg.oauthClientSecret,
    refresh_token: account.refreshToken,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await r.text();
  console.log('  refresh response status:', r.status);
  console.log('  refresh response body:', text.slice(0, 500));

  if (r.ok) {
    const j = JSON.parse(text);
    console.log('\nNow testing Ads API call with fresh access token...');
    const url = `https://googleads.googleapis.com/v24/customers/${account.customerId}/googleAds:search`;
    const headers: any = {
      Authorization: `Bearer ${j.access_token}`,
      'developer-token': cfg.developerToken,
      'Content-Type': 'application/json',
    };
    if (account.loginCustomerId) headers['login-customer-id'] = account.loginCustomerId;
    console.log('  url:', url);
    console.log('  login-customer-id:', account.loginCustomerId);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: 'SELECT campaign.id, campaign.name FROM campaign LIMIT 1' }),
    });
    const t = await res.text();
    console.log('  ads api status:', res.status);
    console.log('  ads api body:', t.slice(0, 800));
  }
  await p.$disconnect();
})();
