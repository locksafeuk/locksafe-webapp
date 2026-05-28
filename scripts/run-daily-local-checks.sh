#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

REPORT_DIR="$ROOT_DIR/reports/daily-checks"
mkdir -p "$REPORT_DIR"

STAMP="$(date '+%Y-%m-%dT%H-%M-%S')"
SUMMARY_FILE="$REPORT_DIR/daily-checks-$STAMP.summary.txt"
LOG_FILE="$REPORT_DIR/daily-checks-$STAMP.log"

touch "$SUMMARY_FILE"
touch "$LOG_FILE"

echo "============================================" | tee -a "$LOG_FILE"
echo "LockSafe Local Daily Checks" | tee -a "$LOG_FILE"
echo "Root: $ROOT_DIR" | tee -a "$LOG_FILE"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')" | tee -a "$LOG_FILE"
echo "Summary: $SUMMARY_FILE" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"

FAILED=0

run_check() {
  local name="$1"
  local command="$2"

  echo | tee -a "$LOG_FILE"
  echo "[CHECK] $name" | tee -a "$LOG_FILE"
  echo "[CMD]   $command" | tee -a "$LOG_FILE"

  bash -lc "$command" >>"$LOG_FILE" 2>&1
  local exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    echo "PASS | $name" | tee -a "$SUMMARY_FILE"
    echo "[PASS] $name" | tee -a "$LOG_FILE"
  else
    FAILED=$((FAILED + 1))
    echo "FAIL | $name | exit=$exit_code" | tee -a "$SUMMARY_FILE"
    echo "[FAIL] $name (exit $exit_code)" | tee -a "$LOG_FILE"
  fi
}

run_check "Reliability daily prod" "npm run reliability:daily:prod"
run_check "Agents runtime verify" "npm run verify:agents-runtime"
run_check "System test prod" "npm run test:system:prod"
run_check "Source + Prisma fast validation" "bash ./scripts/validate-source-and-prisma.sh"

echo | tee -a "$LOG_FILE"
echo "[CHECK] Single Telegram summary" | tee -a "$LOG_FILE"
if npx tsx --tsconfig tsconfig.scripts.json ./scripts/send-daily-checks-telegram-summary.ts \
  --summary "$SUMMARY_FILE" \
  --log "$LOG_FILE" \
  --failed "$FAILED" >>"$LOG_FILE" 2>&1; then
  echo "[PASS] Single Telegram summary sent" | tee -a "$LOG_FILE"
else
  echo "[WARN] Single Telegram summary failed to send" | tee -a "$LOG_FILE"
fi

echo | tee -a "$LOG_FILE"
echo "============================================" | tee -a "$LOG_FILE"
if [ "$FAILED" -eq 0 ]; then
  echo "Daily checks PASSED" | tee -a "$LOG_FILE"
  echo "RESULT | PASS" | tee -a "$SUMMARY_FILE"
else
  echo "Daily checks FAILED: $FAILED check(s)" | tee -a "$LOG_FILE"
  echo "RESULT | FAIL | count=$FAILED" | tee -a "$SUMMARY_FILE"
fi
echo "============================================" | tee -a "$LOG_FILE"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
