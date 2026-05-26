#!/bin/bash
# Commit the launcher scripts + .command files that make the discovery
# pipeline reproducible from a fresh clone. The phase2a/2b/2c feature
# commits already shipped via their own deploy commands — this batch
# is purely the operator-facing entry points.

set -e
trap 'echo ""; echo "✗ aborted — press enter to close"; read; exit 1' ERR
cd "$(dirname "$0")"

git add \
  scripts/launch-discovery-campaigns.ts \
  scripts/run-postcode-keyword-generator.ts \
  seed-keyword-bank.command \
  review-discovery-campaigns.command \
  launch-discovery-campaigns-LIVE.command

git diff --cached --stat
echo ""

git commit -m "feat(phase2-launch): operator entry points for discovery pipeline

Adds the three double-clickable .command runners + their backing
scripts so a fresh clone can drive the full Phase 2 launch from the
Finder without remembering ts-node flags:

  seed-keyword-bank.command
    → scripts/run-postcode-keyword-generator.ts
    Dry-run preview of the postcode × service generator, then prompts
    'go' before writing seeds. Reads LocksmithCoverage so seeds never
    outrun what we can fulfil.

  review-discovery-campaigns.command
    → scripts/launch-discovery-campaigns.ts
    DRY-RUN view of the orchestrator's top-6 pick: family, district,
    keyword, phone-lead intent score, daily budget, draft name. Zero
    writes. Use before every live run.

  launch-discovery-campaigns-LIVE.command
    → scripts/launch-discovery-campaigns.ts --live
    Requires typing 'go'. Writes 6 GoogleAdsCampaignDraft rows as
    PENDING_APPROVAL. Idempotent — re-runs never double-create.
    Refuses to LIVE-write with the placeholder phone (proves
    .env wiring is correct).

Both scripts load .env via dotenv before any other import and pull
the shared website phone in priority order:
  LOCKSAFE_WEBSITE_PHONE → RETELL_PHONE_NUMBER → placeholder (rejected
  in live mode).

ts-node invoked with --transpile-only so the existing
scripts/tsconfig.scripts.json (no paths) doesn't trip over '@/*'
imports in transitively-loaded src/lib files — the runtime
tsconfig-paths.register call handles resolution at require time."

git push origin main
echo ""
echo "✓ pushed"
read -p "press enter to close..."
