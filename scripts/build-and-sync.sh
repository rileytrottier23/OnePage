#!/bin/bash
# Build script for Replit deployments.
# Runs the standard build then syncs to GitHub if GITHUB_TOKEN is available.
set -e

echo "=== Building application ==="
npm run build

echo "=== Syncing to GitHub ==="
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set — skipping GitHub sync. Set it in Replit Secrets to automate sync."
else
  bash scripts/sync-to-github.sh
fi
