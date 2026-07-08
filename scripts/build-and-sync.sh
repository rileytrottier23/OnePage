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
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║  WARNING: GitHub sync failed (exit code ${SYNC_EXIT}) — deploy continues  ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  The deployment itself completed successfully and is now serving traffic."
    echo "  The GitHub mirror sync did NOT complete — see the output above for details."
    echo ""
    echo "  Most common cause: expired or revoked GITHUB_TOKEN."
    echo "  ➜  Open the Replit Secrets panel (padlock icon in the sidebar,"
    echo "     or Tools → Secrets) and update the GITHUB_TOKEN secret."
    echo "     See https://github.com/settings/tokens to generate a new token."
    echo ""
    echo "  Other possible causes: network error, diverged git history."
    echo "  Re-run a deploy once the token is refreshed to sync the latest build."
    echo ""
  else
    echo "GitHub sync completed successfully."
  fi
fi

echo "=== Build complete ==="
