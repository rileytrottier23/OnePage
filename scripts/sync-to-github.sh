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
if ! git push origin "${BRANCH}" 2>&1; then
  echo "Fast-forward push failed; pulling remote changes and retrying..."
  git pull --rebase origin "${BRANCH}"
  git push origin "${BRANCH}"
fi
echo "Push succeeded."

SHA=$(git rev-parse HEAD)
REF="refs/heads/${BRANCH}"

echo "Dispatching repository_dispatch to GitHub Actions..."
HTTP_STATUS=$(curl -s -o /tmp/gh-dispatch-response.json -w "%{http_code}" \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO}/dispatches" \
  -d "{\"event_type\":\"replit-deploy\",\"client_payload\":{\"sha\":\"${SHA}\",\"ref\":\"${REF}\"}}")

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "repository_dispatch sent (HTTP ${HTTP_STATUS})."
else
  echo "WARNING: repository_dispatch returned HTTP ${HTTP_STATUS}."
  cat /tmp/gh-dispatch-response.json 2>/dev/null || true
  exit 1
fi

echo "Done. GitHub repo is now up-to-date at ${SHA}."
