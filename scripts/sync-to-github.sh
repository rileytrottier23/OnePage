#!/bin/bash
# Pushes the current Replit commit to GitHub and dispatches a repository_dispatch event.
# Requires GITHUB_TOKEN to be set as a Replit secret.
# Usage: bash scripts/sync-to-github.sh

set -e

REPO="rileytrottier23/OnePage"
BRANCH="main"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret is not set."
  echo "Add it in Replit's Secrets panel (Settings → Secrets) as GITHUB_TOKEN."
  exit 1
fi

echo "Configuring git..."
git config user.email "replit-deploy@users.noreply.github.com"
git config user.name "Replit Deploy Bot"
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

echo "Pushing ${BRANCH} to GitHub..."
git push origin "${BRANCH}"

SHA=$(git rev-parse HEAD)
REF="refs/heads/${BRANCH}"

echo "Dispatching repository_dispatch to GitHub Actions..."
curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO}/dispatches" \
  -d "{\"event_type\":\"replit-deploy\",\"client_payload\":{\"sha\":\"${SHA}\",\"ref\":\"${REF}\"}}"

echo ""
echo "Done. GitHub repo is now up-to-date."
