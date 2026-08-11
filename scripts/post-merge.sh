#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# Timing budget: the Replit postMerge hook has a 60-second wall-clock limit
# (timeoutMs = 60000 in .replit).  Each phase below prints its elapsed time
# so we can see at a glance whether we are in danger of hitting the ceiling.
#
# Measured warm/cached baselines (as of 2026-08):
#   npm install  ≈ 4 s  (node_modules present, nothing new to download)
#   db:push      ≈ 5 s  (schema unchanged → "no changes detected")
#   GitHub sync  ≈ 5–15 s depending on repo size and network latency
# Total expected ≈ 14–24 s → comfortably inside the 60 s budget.
# ---------------------------------------------------------------------------

SCRIPT_START=$(date +%s)

elapsed() {
  echo "  ⏱  $1 took $(( $(date +%s) - $2 ))s"
}

# ---------------------------------------------------------------------------
# 1. Install dependencies
# ---------------------------------------------------------------------------
echo "=== npm install ==="
T0=$(date +%s)
npm install
elapsed "npm install" "$T0"

# ---------------------------------------------------------------------------
# 2. Push database schema
# ---------------------------------------------------------------------------
echo ""
echo "=== db:push ==="
T0=$(date +%s)
npm run db:push -- --force
elapsed "db:push" "$T0"

# ---------------------------------------------------------------------------
# 3. Sync to GitHub (non-fatal — post-merge always succeeds even if this fails)
# ---------------------------------------------------------------------------
echo ""
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set — skipping GitHub sync. Add it in Replit Secrets to enable automatic sync."
else
  echo "=== Syncing to GitHub ==="
  T0=$(date +%s)
  if bash scripts/sync-to-github.sh; then
    elapsed "GitHub sync" "$T0"
    echo "GitHub sync complete."
  else
    elapsed "GitHub sync (failed)" "$T0"
    echo "WARNING: GitHub sync failed (exit $?). Replit changes are safe; push to GitHub manually if needed."
  fi
fi

echo ""
echo "=== post-merge total: $(( $(date +%s) - SCRIPT_START ))s ==="
