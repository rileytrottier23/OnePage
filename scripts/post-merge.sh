#!/bin/bash
set -e

npm install
npm run db:push -- --force

# Sync to GitHub after every merge — non-fatal so post-merge always succeeds
if [ -z "$GITHUB_TOKEN" ]; then
  echo "GITHUB_TOKEN not set — skipping GitHub sync. Add it in Replit Secrets to enable automatic sync."
else
  echo "=== Syncing to GitHub ==="
  if bash scripts/sync-to-github.sh; then
    echo "GitHub sync complete."
  else
    echo "WARNING: GitHub sync failed (exit $?). Replit changes are safe; push to GitHub manually if needed."
  fi
fi
