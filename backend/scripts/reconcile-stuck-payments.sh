#!/bin/bash
# ============================================================
# Reconcile Stuck Payments — One-Command Runbook
#
# Usage:
#   ./scripts/reconcile-stuck-payments.sh [--dry-run] [--yes]
#
# Flags:
#   --dry-run   Report stuck payment state without triggering transfers
#   --yes       Skip confirmation prompt (for CI/automation)
#
# Prerequisites:
#   - ADMIN_TOKEN: a valid admin user JWT (Bearer token)
#   - Backend server running
#   - API_BASE_URL set (defaults to http://localhost:8000)
#
# What this does:
#   1. Checks payment health (stuck counts)
#   2. Shows stuck payment details
#   3. (Unless --dry-run) Triggers processPendingTransfers manually
#   4. Re-checks health after processing
#
# All output is logged to a timestamped file in /tmp.
#
# For SQL-level reconciliation, run migration 094 directly:
#   psql $DATABASE_URL -f backend/database/migrations/094_reconcile_stuck_payments.sql
# ============================================================

set -euo pipefail

DRY_RUN=false
AUTO_YES=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes)     AUTO_YES=true ;;
    *)
      echo "Unknown flag: $arg"
      echo "Usage: $0 [--dry-run] [--yes]"
      exit 1
      ;;
  esac
done

API_BASE="${API_BASE_URL:-http://localhost:8000}"
AUTH_HEADER=""
LOG_FILE="/tmp/reconcile-stuck-payments-$(date +%Y%m%d-%H%M%S).log"

if [ -n "${ADMIN_TOKEN:-}" ]; then
  AUTH_HEADER="Authorization: Bearer $ADMIN_TOKEN"
else
  echo "ERROR: Set ADMIN_TOKEN env var to a valid admin JWT."
  echo "  Obtain one via: supabase auth sign-in or your admin login flow."
  exit 1
fi

# Log to both stdout and file
log() {
  echo "$@" | tee -a "$LOG_FILE"
}

log "=== Payment Reconciliation Runbook ==="
log "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "API: $API_BASE"
log "Mode: $(if $DRY_RUN; then echo 'DRY RUN (read-only)'; else echo 'LIVE'; fi)"
log "Log file: $LOG_FILE"
log ""

# Step 1: Check current health
log "--- Step 1: Checking payment health ---"
HEALTH=$(curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  "$API_BASE/api/admin/payment-ops/health" 2>&1) || {
  log "ERROR: Health check failed. Is the server running? Is auth correct?"
  log "$HEALTH"
  exit 1
}
echo "$HEALTH" | python3 -m json.tool 2>/dev/null | tee -a "$LOG_FILE" || log "$HEALTH"
log ""

# Step 2: Show stuck payment details
log "--- Step 2: Checking stuck payment details ---"
STUCK=$(curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  "$API_BASE/api/admin/payment-ops/stuck" 2>&1) || {
  log "WARNING: Stuck check failed"
}
echo "$STUCK" | python3 -m json.tool 2>/dev/null | tee -a "$LOG_FILE" || log "$STUCK"
log ""

if $DRY_RUN; then
  log "--- Dry run complete. No transfers triggered. ---"
  log "Re-run without --dry-run to process stuck payments."
  log "=== Done (dry run) ==="
  exit 0
fi

# Step 3: Confirmation prompt
if ! $AUTO_YES; then
  echo ""
  echo "This will trigger processPendingTransfers, which modifies payment state."
  echo -n "Continue? [y/N] "
  read -r CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    log "Aborted by user."
    exit 0
  fi
  log "User confirmed."
  log ""
fi

# Step 4: Trigger transfer processing
log "--- Step 3: Triggering processPendingTransfers ---"
TRIGGER=$(curl -sf -X POST -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"reason":"reconciliation runbook"}' \
  "$API_BASE/api/admin/payment-ops/trigger-transfers" 2>&1) || {
  log "WARNING: Transfer trigger failed (may be expected if no stuck rows)"
  log "$TRIGGER"
}
echo "$TRIGGER" | python3 -m json.tool 2>/dev/null | tee -a "$LOG_FILE" || log "$TRIGGER"
log ""

# Step 5: Re-check health
log "--- Step 4: Re-checking health after processing ---"
sleep 2
HEALTH_AFTER=$(curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  "$API_BASE/api/admin/payment-ops/health" 2>&1) || {
  log "ERROR: Post-processing health check failed"
  exit 1
}
echo "$HEALTH_AFTER" | python3 -m json.tool 2>/dev/null | tee -a "$LOG_FILE" || log "$HEALTH_AFTER"
log ""

# Step 6: Show remaining stuck
log "--- Step 5: Checking for remaining stuck payments ---"
STUCK_AFTER=$(curl -sf -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  "$API_BASE/api/admin/payment-ops/stuck" 2>&1) || {
  log "WARNING: Stuck check failed"
}
echo "$STUCK_AFTER" | python3 -m json.tool 2>/dev/null | tee -a "$LOG_FILE" || log "$STUCK_AFTER"
log ""

log "=== Reconciliation complete ==="
log "Full log saved to: $LOG_FILE"
if echo "$STUCK_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); total=d.get('total_stuck', d.get('total', 0)); sys.exit(0 if int(total or 0)==0 else 1)" 2>/dev/null; then
  log "All stuck payments resolved."
else
  log "Some stuck payments remain. Consider running migration 094 directly:"
  log "  psql \$DATABASE_URL -f backend/database/migrations/094_reconcile_stuck_payments.sql"
fi
