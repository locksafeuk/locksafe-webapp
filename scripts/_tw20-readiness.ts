/** READ ONLY — is a locksmith ready to take a TW20 job? */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
// TW20 (Englefield Green / Egham) approx centroid
const TW20_LAT = 51.4308, TW20_LNG = -0.5505;
function miles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8, d2r = Math.PI / 180;
  const dLat = (bLat - aLat) * d2r, dLng = (bLng - aLng) * d2r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * d2r) * Math.cos(bLat * d2r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
(async () => {
  const locks = await p.locksmith.findMany({
    where: { baseLat: { not: null }, baseLng: { not: null } },
    select: { name: true, email: true, phone: true, baseLat: true, baseLng: true, coverageRadius: true,
      isActive: true, isAvailable: true, onboardingCompleted: true, stripeConnectVerified: true, baseAddress: true },
  });
  const ranked = locks
    .map((l) => ({ ...l, dist: miles(TW20_LAT, TW20_LNG, l.baseLat!, l.baseLng!) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 8);
  console.log("=== Locksmiths nearest TW20 (top 8) ===");
  for (const l of ranked) {
    const covers = l.dist <= (l.coverageRadius ?? 10);
    const ready = l.isActive && l.isAvailable && l.onboardingCompleted && l.stripeConnectVerified && covers;
    console.log(`${ready ? "✅READY" : "  ----"} ${l.dist.toFixed(1)}mi  ${(l.name||"?").padEnd(22)} ${(l.email||"").padEnd(28)} radius=${l.coverageRadius}mi covers=${covers} active=${l.isActive} avail=${l.isAvailable} onboarded=${l.onboardingCompleted} connect=${l.stripeConnectVerified}`);
  }
  const anyReady = ranked.some((l) => l.isActive && l.isAvailable && l.onboardingCompleted && l.stripeConnectVerified && l.dist <= (l.coverageRadius ?? 10));
  console.log(`\nTW20 has a fully-ready locksmith in range? ${anyReady ? "YES" : "NO — fix before test"}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
