#!/bin/bash
# Pushes the current Replit commit to GitHub and dispatches a repository_dispatch event.
# Requires GITHUB_PERSONAL_ACCESS_TOKEN (preferred) or GITHUB_TOKEN to be set as a Replit secret.
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
#
# Concurrency guard
# -----------------
# A file-based exclusive lock (/tmp/sync-to-github.lock) is acquired with
# flock before the fetch step. A second concurrent invocation that cannot
# acquire the lock exits cleanly (exit 0) rather than proceeding to push.
# The lock is released automatically when the process exits, whether by
# success, failure, or signal.

set -euo pipefail

REPO="rileytrottier23/OnePage"
BRANCH="main"
STATUS_FILE=".sync-status.json"
LOCK_FILE="/tmp/sync-to-github.lock"

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

# ---------------------------------------------------------------------------
# Credential selection — prefer GITHUB_PERSONAL_ACCESS_TOKEN, fall back to GITHUB_TOKEN
# ---------------------------------------------------------------------------
if [ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]; then
  SYNC_TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN}"
  SYNC_TOKEN_VAR="GITHUB_PERSONAL_ACCESS_TOKEN"
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  SYNC_TOKEN="${GITHUB_TOKEN}"
  SYNC_TOKEN_VAR="GITHUB_TOKEN"
else
  write_status "failure" "" "No sync credential found. Set GITHUB_PERSONAL_ACCESS_TOKEN in Replit's Secrets panel (preferred), or GITHUB_TOKEN as a fallback. No code was pushed to GitHub."
  echo ""
  echo "ERROR: No sync credential is set."
  echo "  Neither GITHUB_PERSONAL_ACCESS_TOKEN nor GITHUB_TOKEN is present in the environment."
  echo "  Add GITHUB_PERSONAL_ACCESS_TOKEN in Replit's Secrets panel (padlock icon)."
  echo "  No code was pushed to GitHub."
  echo ""
  exit 1
fi

# ---------------------------------------------------------------------------
# Pre-flight: verify the credential is valid before touching git
# ---------------------------------------------------------------------------
echo "Verifying \$${SYNC_TOKEN_VAR}..."
TOKEN_CHECK_STATUS=$(curl -s --max-time 15 \
  -o /tmp/gh-token-check.json \
  -w "%{http_code}" \
  -H "Authorization: Bearer ${SYNC_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/user")
PREFLIGHT_CURL_EXIT=$?

if [ $PREFLIGHT_CURL_EXIT -ne 0 ] || [ "$TOKEN_CHECK_STATUS" = "000" ]; then
  write_status "failure" "" "Network error reaching GitHub API (curl exit ${PREFLIGHT_CURL_EXIT}, HTTP ${TOKEN_CHECK_STATUS}). This is a connectivity problem, not a credential problem. No code was pushed to GitHub."
  echo ""
  echo "ERROR: Could not reach GitHub API — network or connectivity problem."
  echo "  Credential read from: \$${SYNC_TOKEN_VAR}"
  echo "  curl exit code:       ${PREFLIGHT_CURL_EXIT}"
  echo "  HTTP status:          ${TOKEN_CHECK_STATUS}"
  echo "  This is NOT a credential error. No code was pushed to GitHub."
  echo "  Check your network connection and try again."
  echo ""
  exit 1
fi

if [ "$TOKEN_CHECK_STATUS" -eq 401 ] || [ "$TOKEN_CHECK_STATUS" -eq 403 ]; then
  write_status "failure" "" "${SYNC_TOKEN_VAR} is invalid or expired (HTTP ${TOKEN_CHECK_STATUS}). No code was pushed to GitHub. Update ${SYNC_TOKEN_VAR} in Replit's Secrets panel."
  echo ""
  echo "ERROR: Sync credential is invalid or expired — no code was pushed to GitHub."
  echo "  Credential read from: \$${SYNC_TOKEN_VAR}"
  echo "  GitHub API response:  HTTP ${TOKEN_CHECK_STATUS} (authentication rejected)"
  echo "  This is an authentication failure, not a network problem."
  echo ""
  echo "  To fix this:"
  echo "  1. Go to https://github.com/settings/tokens and generate a new PAT"
  echo "     with 'repo' scope (or fine-grained: Contents + Metadata read/write)."
  echo "  2. In Replit's Secrets panel (padlock icon), update \$${SYNC_TOKEN_VAR}."
  echo "  3. Re-run this sync or redeploy."
  echo ""
  exit 1
fi

if [ "$TOKEN_CHECK_STATUS" -lt 200 ] || [ "$TOKEN_CHECK_STATUS" -ge 300 ]; then
  write_status "failure" "" "GitHub API returned unexpected HTTP ${TOKEN_CHECK_STATUS} during preflight (credential: ${SYNC_TOKEN_VAR}). This may be a GitHub outage or transient error. No code was pushed to GitHub."
  echo ""
  echo "ERROR: GitHub API returned an unexpected status during preflight — no code was pushed to GitHub."
  echo "  Credential read from: \$${SYNC_TOKEN_VAR}"
  echo "  GitHub API response:  HTTP ${TOKEN_CHECK_STATUS}"
  echo "  This is likely a GitHub outage or transient API error, not a credential problem."
  cat /tmp/gh-token-check.json 2>/dev/null || true
  echo ""
  exit 1
fi

echo "Credential OK (\$${SYNC_TOKEN_VAR}, HTTP ${TOKEN_CHECK_STATUS})."

# ---------------------------------------------------------------------------
# Configure git remote
# ---------------------------------------------------------------------------
echo "Configuring git..."
git config user.email "replit-deploy@users.noreply.github.com"
git config user.name "Replit Deploy Bot"
git remote set-url origin "https://x-access-token:${SYNC_TOKEN}@github.com/${REPO}.git"

# ---------------------------------------------------------------------------
# Concurrency lock — only one sync instance may run at a time
# ---------------------------------------------------------------------------
# Open (or create) the lock file on fd 200, then acquire an exclusive lock.
# -n makes flock non-blocking: a second concurrent invocation prints a clear
# message and exits 0 rather than proceeding to push or hanging indefinitely.
# The lock is released automatically when the process exits (success or failure).
exec 200>>"${LOCK_FILE}"
if ! flock -n 200; then
  echo ""
  echo "INFO: Another sync is already in progress (lock held: ${LOCK_FILE})."
  echo "  Exiting without pushing to avoid a concurrent-push race."
  echo ""
  exit 0
fi
echo "Lock acquired (${LOCK_FILE}). Proceeding with sync..."

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
  -H "Authorization: Bearer ${SYNC_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO}/dispatches" \
  -d "{\"event_type\":\"replit-deploy\",\"client_payload\":{\"sha\":\"${SHA}\",\"ref\":\"${REF}\"}}")

if [ "$HTTP_STATUS" -eq 401 ] || [ "$HTTP_STATUS" -eq 403 ]; then
  write_status "failure" "${SHA}" "repository_dispatch rejected (HTTP ${HTTP_STATUS}) — ${SYNC_TOKEN_VAR} is invalid or expired. Update ${SYNC_TOKEN_VAR} in Replit's Secrets panel."
  echo ""
  echo "ERROR: repository_dispatch rejected (HTTP ${HTTP_STATUS}) — \$${SYNC_TOKEN_VAR} is invalid or expired."
  echo "  Update \$${SYNC_TOKEN_VAR} in Replit's Secrets panel."
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
