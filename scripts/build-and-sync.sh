#!/bin/bash
# Build script for Replit deployments.
# Runs the standard build then syncs to GitHub if GITHUB_TOKEN is available.
#
# Sync-failure policy
# -------------------
# A GitHub sync failure is treated as a WARNING, not a deployment blocker.
# The build (npm run build) must succeed for the deployment to proceed, but
# a broken token, network hiccup, or repo conflict during the sync step will
# only print a warning — the deploy itself will still be marked as successful.
#
# Rationale: the deployed application should reach users even when the
# GitHub mirror is temporarily unavailable. Fix the sync separately without
# rolling back a good deploy.
#
# To change this to abort-on-sync-failure, replace the warn-only block below
# with: `bash scripts/sync-to-github.sh` (inherits set -e from this script).
set -e

echo "=== Building application ==="
npm run build

echo "=== Syncing to GitHub ==="
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set — skipping GitHub sync. Set it in Replit Secrets to automate sync."
else
  # Run sync in a subshell and capture its exit code without letting set -e
  # abort the overall build. A sync failure is a warning, not a blocker.
  set +e
  bash scripts/sync-to-github.sh
  SYNC_EXIT=$?
  set -e

  if [ "$SYNC_EXIT" -ne 0 ]; then
    echo ""
    echo "WARNING: GitHub sync exited with code ${SYNC_EXIT}."
    echo "  The deployment itself will proceed successfully."
    echo "  Review the output above to diagnose and fix the sync issue separately."
    echo "  Common causes: expired GITHUB_TOKEN, network error, diverged history."
    echo ""
  else
    echo "GitHub sync completed successfully."
  fi
fi

echo "=== Build complete ==="
