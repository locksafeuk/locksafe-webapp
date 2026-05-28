#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "============================================"
echo "LockSafe Source + Prisma Validation (Fast)"
echo "Root: $ROOT_DIR"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "============================================"

run_step() {
  local name="$1"
  shift

  echo
  echo "[STEP] $name"
  "$@"
  local exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    echo "[PASS] $name"
    return 0
  fi

  echo "[FAIL] $name (exit $exit_code)"
  return "$exit_code"
}

run_step "Prisma schema validation" npx prisma validate || exit 1
run_step "Prisma client generation" npm run db:generate || exit 1
run_step "TypeScript + ESLint" npm run lint || exit 1
run_step "Unit tests" npm test -- --runInBand || exit 1

echo
echo "============================================"
echo "Validation passed"
echo "============================================"
