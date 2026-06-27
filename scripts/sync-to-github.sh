#!/bin/bash
# Pushes the current Replit commit to GitHub and dispatches a repository_dispatch event.
# Requires GITHUB_TOKEN to be set as a Replit secret.
# Usage: bash scripts/sync-to-github.sh
#
# Push safety model
# -----------------
# Before every push this script fetches the remote branch and classifies the
# relationship between local HEAD and origin/<BRANCH>:
#
#   1. Already up-to-date  → nothing to do, exit 0.
#   2. Local is strictly ahead  → safe fast-forward; push with --force-with-lease
#      so a race between fetch and push is caught and rejected cleanly.
#   3. Remote is strictly ahead  → rebase local onto remote, then push with
#      --force-with-lease.  This is the normal case when a post-merge sync runs
#      right after a deploy-build sync.
#   4. Histories have diverged  → LOUD FAILURE.  Two push paths wrote to
#      GitHub main concurrently.  Human intervention required; the script prints
#      both HEADs and the common ancestor to make triage easier.
#
# Using --force-with-lease on every push means that even if two concurrent
# script instances both pass the pre-push fetch check, only the first one that
# actually reaches GitHub wins; the second sees the lease mismatch and fails
# with a clear error rather than silently creating a fork.

set -euo pipefail

REPO="rileytrottier23/OnePage"
BRANCH="main"
STATUS_FILE=".sync-status.json"

# ---------------------------------------------------------------------------
# Status writer — called at every exit path to record the result in-app
# ---------------------------------------------------------------------------
write_status() {
  local status="$1"      # success | failure | up-to-date
  local sha="$2"         # commit SHA (may be empty)
  local error_msg="$3"   # human-readable error (empty on success)

  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local actions_url="https://github.com/${REPO}/actions"

  # Escape double-quotes in the error message for safe JSON embedding
  local safe_error
  safe_error=$(printf '%s' "$error_msg" | sed 's/\\/\\\\/g; s/"/\\"/g; s/$/\\n/g' | tr -d '\n' | sed 's/\\n$//')

  cat > "$STATUS_FILE" <<EOF
{
  "status": "${status}",
  "timestamp": "${timestamp}",
  "sha": "${sha}",
  "error": "${safe_error}",
  "actionsUrl": "${actions_url}"
}
EOF
  echo "Deploy status written to ${STATUS_FILE} (status=${status})"
}

if [ -z "${GITHUB_TOKEN:-}" ]; then
  write_status "failure" "" "GITHUB_TOKEN secret is not set. Add it in Replit's Secrets panel (Settings → Secrets) as GITHUB_TOKEN."
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
  write_status "failure" "" "GITHUB_TOKEN is invalid or expired (HTTP ${TOKEN_CHECK_STATUS}). Go to https://github.com/settings/tokens and generate a new token with repo scope, then update the GITHUB_TOKEN secret in Replit."
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
# Configure git remote
# ---------------------------------------------------------------------------
echo "Configuring git..."
git config user.email "replit-deploy@users.noreply.github.com"
git config user.name "Replit Deploy Bot"
git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"

# ---------------------------------------------------------------------------
# Fetch remote state — always do this before any push decision
# ---------------------------------------------------------------------------
echo "Fetching remote state from origin/${BRANCH}..."
git fetch origin "${BRANCH}"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/${BRANCH}")
BASE=$(git merge-base HEAD "origin/${BRANCH}")

echo "  Local HEAD : ${LOCAL}"
echo "  Remote HEAD: ${REMOTE}"
echo "  Common base: ${BASE}"

if [ "$LOCAL" = "$REMOTE" ]; then
  # Case 1: nothing to do
  echo "Already up-to-date with remote. Skipping push."
  write_status "up-to-date" "${LOCAL}" ""

elif [ "$BASE" = "$REMOTE" ]; then
  # Case 2: local is strictly ahead of remote — safe fast-forward
  echo "Local is ahead of remote. Pushing (fast-forward)..."
  if ! git push --force-with-lease origin "${BRANCH}"; then
    write_status "failure" "${LOCAL}" "Push rejected by GitHub (--force-with-lease mismatch). Another push landed on remote between our fetch and this push. Re-run sync to fetch the new state and retry."
    echo ""
    echo "ERROR: Push rejected by GitHub (--force-with-lease mismatch)."
    echo "  Another push landed on remote between our fetch and this push."
    echo "  Re-run sync to fetch the new state and retry."
    echo ""
    exit 1
  fi

elif [ "$BASE" = "$LOCAL" ]; then
  # Case 3: remote is strictly ahead — rebase then push
  echo "Remote has commits that are not in local. Rebasing onto origin/${BRANCH}..."
  if ! git rebase "origin/${BRANCH}"; then
    write_status "failure" "${LOCAL}" "Rebase onto origin/${BRANCH} produced conflicts. Resolve conflicts manually, then re-run sync."
    echo ""
    echo "ERROR: Rebase onto origin/${BRANCH} produced conflicts."
    echo "  This should not happen in normal automated sync."
    echo "  Resolve conflicts manually, then re-run sync."
    echo ""
    git rebase --abort 2>/dev/null || true
    exit 1
  fi
  echo "Rebase succeeded. Pushing..."
  if ! git push --force-with-lease origin "${BRANCH}"; then
    write_status "failure" "${LOCAL}" "Push rejected by GitHub (--force-with-lease mismatch). Another push landed on remote between our rebase and this push. Re-run sync to fetch the new state and retry."
    echo ""
    echo "ERROR: Push rejected by GitHub (--force-with-lease mismatch)."
    echo "  Another push landed on remote between our rebase and this push."
    echo "  Re-run sync to fetch the new state and retry."
    echo ""
    exit 1
  fi

else
  # Case 4: histories have diverged — loud failure, no silent force-push
  write_status "failure" "${LOCAL}" "Local and remote histories have DIVERGED. Local: ${LOCAL}, Remote: ${REMOTE}, Common base: ${BASE}. Two separate push paths wrote to GitHub main concurrently. Human intervention required."
  echo ""
  echo "ERROR: Local and remote histories have DIVERGED — cannot fast-forward."
  echo ""
  echo "  Local HEAD : ${LOCAL}"
  echo "  Remote HEAD: ${REMOTE}"
  echo "  Common base: ${BASE}"
  echo ""
  echo "  This means two separate push paths wrote to GitHub main concurrently"
  echo "  (e.g. a deploy-build sync and a post-merge sync raced each other)."
  echo ""
  echo "  To recover:"
  echo "  1. Decide which history is authoritative (usually the Replit local branch)."
  echo "  2. If local is correct, reset remote:  git push --force origin ${BRANCH}"
  echo "     (only do this after confirming no one else has branched off the remote)."
  echo "  3. If remote is correct, reset local:  git reset --hard origin/${BRANCH}"
  echo "  4. Re-run sync once histories are reconciled."
  echo ""
  exit 1
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
  write_status "failure" "${SHA}" "repository_dispatch rejected (HTTP ${HTTP_STATUS}) — GITHUB_TOKEN is invalid or expired. Update GITHUB_TOKEN in Replit's Secrets panel."
  echo ""
  echo "ERROR: repository_dispatch rejected (HTTP ${HTTP_STATUS}) — GITHUB_TOKEN is invalid or expired."
  echo "  Update GITHUB_TOKEN in Replit's Secrets panel."
  cat /tmp/gh-dispatch-response.json 2>/dev/null || true
  exit 1
fi

if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 300 ]; then
  echo "repository_dispatch sent (HTTP ${HTTP_STATUS})."
else
  write_status "failure" "${SHA}" "repository_dispatch returned unexpected HTTP ${HTTP_STATUS}."
  echo "WARNING: repository_dispatch returned HTTP ${HTTP_STATUS}."
  cat /tmp/gh-dispatch-response.json 2>/dev/null || true
  exit 1
fi

write_status "success" "${SHA}" ""
echo "Done. GitHub repo is now up-to-date at ${SHA}."
