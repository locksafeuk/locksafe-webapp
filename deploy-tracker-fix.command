#!/bin/bash
# Fix tracker.ts merge logic to include utmSource/utmMedium/utmCampaign.
set -e
trap 'echo ""; echo "❌ aborted"; read -p "press enter to close..."; exit 1' ERR
cd "$(dirname "$0")"

git add src/lib/marketing/tracker.ts
git diff --cached --stat
echo ""
git commit -m "fix(tracker): merge ALL UTM fields on session update, not just the new ones

The end-to-end attribution test revealed the merge logic only updated
the fields I added in the recent attribution wiring (gclid, fbclid,
utmContent, utmTerm) but silently skipped the three original UTM
fields (utmSource, utmMedium, utmCampaign).

For visitors with pre-existing UserSession rows (from earlier visits
without UTMs), this meant a new visit WITH UTMs would only fill in
the gclid/utmContent/utmTerm — the others stayed null.

Now all 7 attribution fields are merged with first-touch semantics:
never overwrite a value, but fill in nulls from later visits with
proper attribution. Test query confirmed gclid lands; utmCampaign
and utmSource were missing pre-fix."

git push origin main
echo ""
echo "✓ pushed — Vercel auto-deploys"
read -p "press enter to close..."
