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

# ---------------------------------------------------------------------------
# Pre-flight: verify the token is valid before touching git
# ---------------------------------------------------------------------------
echo "Verifying GITHUB_TOKEN..."
TOKEN_CHECK_STATUS=$(curl -s -o /tmp/gh-token-check.json -w "%{http_code}" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/user")

if [ "$TOKEN_CHECK_STATUS" -eq 401 ] || [ "$TOKEN_CHECK_STATUS" -eq 403 ]; then
  echo ""
  echo "ERROR: GITHUB_TOKEN is invalid or expired (HTTP ${TOKEN_CHECK_STATUS})."
  echo ""
  echo "  To fix this:"
  echo "  1. Go to https://github.com/settings/tokens and generate a new Personal Access Token"
  echo "     with 'repo' scope (fine-grained PAT: Contents read & write, Metadata read)."
  echo "  2. Open the Replit Secrets panel (padlock icon in the sidebar, or Settings → Secrets)."
  echo "  3. Update the GITHUB_TOKEN secret with the new token value."
  echo "  4. Re-run this sync or redeploy."
  echo ""
  echo "  Token expiry tip: fine-grained PATs can be set with no expiry, or with a long"
  echo "  expiry (e.g. 1 year). The token-health GitHub Actions workflow (on a weekly"
  echo "  schedule) will warn you before it goes stale if stored as GH_REPLIT_TOKEN."
  echo ""
  exit 1
fi

if [ "$TOKEN_CHECK_STATUS" -lt 200 ] || [ "$TOKEN_CHECK_STATUS" -ge 300 ]; then
  echo "WARNING: GitHub API token check returned unexpected HTTP ${TOKEN_CHECK_STATUS}."
  cat /tmp/gh-token-check.json 2>/dev/null || true
fi

echo "Token OK (HTTP ${TOKEN_CHECK_STATUS})."

# ---------------------------------------------------------------------------
# Configure git and push
# ---------------------------------------------------------------------------
echo "Configuring git..."
git config user.email "replit-deploy@users.noreply.github.com"
git config user.name "Replit Deploy Bot"
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

echo "Pushing ${BRANCH} to GitHub..."
PUSH_OUTPUT=$(git push origin "${BRANCH}" 2>&1) || PUSH_EXIT=$?

if [ "${PUSH_EXIT:-0}" -ne 0 ]; then
  # Surface auth errors with a targeted message
  if echo "$PUSH_OUTPUT" | grep -qiE "invalid credentials|authentication failed|403|401"; then
    echo ""
    echo "ERROR: git push rejected — GITHUB_TOKEN authentication failed."
    echo ""
    echo "  The token may have expired or had its permissions revoked."
    echo "  Update GITHUB_TOKEN in Replit's Secrets panel (padlock icon → Secrets)."
    echo ""
    echo "  Raw git output:"
    echo "$PUSH_OUTPUT"
    exit 1
  fi

  # Not an auth error — try rebase + retry
  echo "Fast-forward push failed; pulling remote changes and retrying..."
  echo "$PUSH_OUTPUT"
  git pull --rebase origin "${BRANCH}"
  git push origin "${BRANCH}"
fi

echo "Push succeeded."

# ---------------------------------------------------------------------------
# Dispatch repository_dispatch event to trigger GitHub Actions
# ---------------------------------------------------------------------------
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

if [ "$HTTP_STATUS" -eq 401 ] || [ "$HTTP_STATUS" -eq 403 ]; then
  echo ""
  echo "ERROR: repository_dispatch rejected (HTTP ${HTTP_STATUS}) — GITHUB_TOKEN is invalid or expired."
  echo "  Update GITHUB_TOKEN in Replit's Secrets panel."
  cat /tmp/gh-dispatch-response.json 2>/dev/null || true
  exit 1
fi

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "repository_dispatch sent (HTTP ${HTTP_STATUS})."
else
  echo "WARNING: repository_dispatch returned HTTP ${HTTP_STATUS}."
  cat /tmp/gh-dispatch-response.json 2>/dev/null || true
  exit 1
fi

echo "Done. GitHub repo is now up-to-date at ${SHA}."
