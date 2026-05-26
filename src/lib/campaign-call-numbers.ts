/**
 * DEPRECATED — DELETE THIS FILE
 *
 * This module implemented per-campaign Zadarma DID provisioning so calls
 * could be hard-attributed to ad campaigns at the phone-number layer. After
 * thinking about it, the chosen attribution strategy is different:
 *
 *   • Website conversions: existing UTM cookie → Job.utmCampaign / gclid
 *   • Phone clicks:        Google Ads' own per-campaign call-click reporting
 *   • Rip-off defence:     Conversions API send on COMPLETED+paid jobs
 *                           so Google bids on real outcomes, not vanity clicks
 *
 * Per-campaign DIDs are unnecessary for that model and add ~£55-90/month of
 * Zadarma rental. The CampaignCallNumber Prisma model has been removed
 * from schema.prisma. This file should be `git rm`'d.
 *
 * If a future requirement reintroduces per-campaign hard attribution
 * (e.g. affiliate programs, white-label channels), the git history of this
 * file is the starting point.
 */
export {};
