#!/usr/bin/env bash
#
# ship.sh — commit and push the webapp. Deployment is AUTOMATIC.
#
# Usage:
#   ./ship.sh "commit message"      # commit all changes + push
#   ./ship.sh                       # uses a default message
#
# Deploy path (single, agreed):
#   git push  →  Vercel ↔ GitHub integration (piky-boy)  →  production deploy
#
#   That GitHub integration is the ONE and ONLY deploy path. We deliberately do
#   NOT run `vercel --prod` here: doing so creates a SECOND, duplicate
#   deployment (the "locksafeuk" CLI one) for the exact same commit, alongside
#   the piky-boy GitHub deploy. One push = one deploy, from piky-boy.
#
# Why this script exists:
#   Claude's sandbox edits files fine but can't reliably run git (it leaves
#   stale .git/*.lock files it has no permission to delete, and it can't push).
#   So Claude only EDITS; you run this to ship. The script cd's to its own
#   directory first, so it always operates on the repo no matter where you
#   invoke it from.

set -uo pipefail

# Always operate from the repo this script lives in (fixes "ran from ~").
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || {
  echo "✗ Could not cd into the repo directory."; exit 1;
}

# Back-compat: tolerate a leading "--no-deploy" (now a no-op — there is no
# manual deploy step left to skip).
if [[ "${1:-}" == "--no-deploy" ]]; then shift; fi

MSG="${1:-chore: update from Claude session}"

echo "▶ Repo: $(pwd)"

# 1. Clear any stale git lock files left by an interrupted process.
rm -f .git/HEAD.lock .git/index.lock .git/refs/heads/*.lock 2>/dev/null || true

# 2. Stage everything and commit (skip cleanly if there's nothing to commit).
git add -A
if git diff --cached --quiet; then
  echo "• No changes to commit — proceeding to push."
else
  git commit -m "$MSG" || { echo "✗ Commit failed."; exit 1; }
  echo "✓ Committed: $MSG"
fi

# 3. Push the CURRENT branch (not hardcoded main) so the commit you just made
#    actually reaches origin and matches what gets deployed.
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "▶ Pushing to origin/${BRANCH}..."
git push -u origin "$BRANCH" || { echo "✗ Push failed (check network / GitHub auth)."; exit 1; }
echo "✓ Pushed ${BRANCH}."

# 4. NO manual deploy. Vercel deploys this push automatically via the GitHub
#    integration (piky-boy). Do NOT add `vercel --prod` back here — it creates a
#    duplicate "locksafeuk" CLI deployment for the same commit.
echo "▶ Vercel will deploy this push automatically (piky-boy GitHub integration)."
echo "  ⚠ Do NOT run 'vercel --prod' — it creates a duplicate 'locksafeuk' deployment."

echo "✅ Done — pushed. piky-boy will deploy it."
