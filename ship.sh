#!/usr/bin/env bash
#
# ship.sh — commit, push, and deploy the webapp in one step.
#
# Usage:
#   ./ship.sh "commit message"      # commit all changes, push, deploy
#   ./ship.sh                       # uses a default message
#   ./ship.sh --no-deploy "msg"     # commit + push only, skip vercel
#
# Why this exists:
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

DEPLOY=1
if [[ "${1:-}" == "--no-deploy" ]]; then
  DEPLOY=0
  shift
fi

MSG="${1:-chore: update from Claude session}"

echo "▶ Repo: $(pwd)"

# 1. Clear any stale git lock files left by an interrupted process.
rm -f .git/HEAD.lock .git/index.lock .git/refs/heads/*.lock 2>/dev/null || true

# 2. Stage everything and commit (skip cleanly if there's nothing to commit).
git add -A
if git diff --cached --quiet; then
  echo "• No changes to commit — proceeding to push/deploy."
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

# 4. Deploy (unless --no-deploy).
if [[ "$DEPLOY" == "1" ]]; then
  echo "▶ Deploying to Vercel (production)..."
  vercel --prod || { echo "✗ Vercel deploy failed."; exit 1; }
  echo "✓ Deploy triggered."
else
  echo "• Skipped deploy (--no-deploy)."
fi

echo "✅ Done."
