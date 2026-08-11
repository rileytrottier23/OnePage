#!/bin/bash
# Test: sync-to-github.sh exits non-zero on diverged history and does NOT call git push.
#
# Setup:
#   - A bare "remote" git repo and a local clone are created in a temp directory.
#   - Both the local repo and the remote receive a distinct commit on top of a
#     shared base, producing a genuine diverged history.
#   - curl is mocked to return HTTP 200 so the GITHUB_TOKEN pre-flight passes.
#   - git is wrapped so that:
#       * "git fetch"        → no-op (keeps the pre-staged diverged state)
#       * "git remote ..."   → no-op (prevents the script from rewriting the URL
#                              to github.com, which we can't reach in tests)
#       * "git push"         → records the call and exits 1 (push must never run)
#       * everything else    → forwarded to the real git binary
#
# Assertions:
#   1. sync-to-github.sh exits with code 1.
#   2. The output contains the expected divergence error message.
#   3. git push was never invoked.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYNC_SCRIPT="$REPO_ROOT/scripts/sync-to-github.sh"
REAL_GIT="/usr/bin/git"

# ---------------------------------------------------------------------------
# Temp workspace
# ---------------------------------------------------------------------------
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

PUSH_LOG="$WORK_DIR/push-calls.log"
touch "$PUSH_LOG"

# ---------------------------------------------------------------------------
# Build diverged git history
# ---------------------------------------------------------------------------
echo "[setup] Creating bare remote repo..."
REMOTE_REPO="$WORK_DIR/remote.git"
"$REAL_GIT" init --bare -b main "$REMOTE_REPO" >/dev/null 2>&1

echo "[setup] Creating local repo..."
LOCAL_REPO="$WORK_DIR/local"
mkdir "$LOCAL_REPO"
cd "$LOCAL_REPO"
"$REAL_GIT" init -b main >/dev/null 2>&1
"$REAL_GIT" config user.email "test@test.com"
"$REAL_GIT" config user.name "Test"

# Shared base commit
echo "base" > base.txt
"$REAL_GIT" add base.txt
"$REAL_GIT" commit -m "base commit" >/dev/null 2>&1

# Push base to remote so origin/main exists
"$REAL_GIT" remote add origin "$REMOTE_REPO"
"$REAL_GIT" push origin main >/dev/null 2>&1

# Add a different commit on the local side (before fetching remote changes)
echo "local change" > local.txt
"$REAL_GIT" add local.txt
"$REAL_GIT" commit -m "local diverged commit" >/dev/null 2>&1

# Add a diverging commit on the remote side (simulate a concurrent push to GitHub)
CLONE_DIR="$WORK_DIR/clone"
"$REAL_GIT" clone "$REMOTE_REPO" "$CLONE_DIR" >/dev/null 2>&1
cd "$CLONE_DIR"
"$REAL_GIT" config user.email "test@test.com"
"$REAL_GIT" config user.name "Test"
echo "remote change" > remote.txt
"$REAL_GIT" add remote.txt
"$REAL_GIT" commit -m "remote diverged commit" >/dev/null 2>&1
"$REAL_GIT" push origin main >/dev/null 2>&1

# Now fetch in the local repo so origin/main points to the remote's diverged HEAD
cd "$LOCAL_REPO"
"$REAL_GIT" fetch origin main >/dev/null 2>&1

# Verify diverged state
LOCAL_SHA=$("$REAL_GIT" rev-parse HEAD)
REMOTE_SHA=$("$REAL_GIT" rev-parse origin/main)
BASE_SHA=$("$REAL_GIT" merge-base HEAD origin/main)

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  echo "SETUP ERROR: local and remote are the same — not diverged!" >&2
  exit 2
fi
if [ "$BASE_SHA" = "$REMOTE_SHA" ] || [ "$BASE_SHA" = "$LOCAL_SHA" ]; then
  echo "SETUP ERROR: not actually diverged (BASE matches LOCAL or REMOTE)." >&2
  exit 2
fi

echo "[setup] Diverged history confirmed."
echo "  local : $LOCAL_SHA"
echo "  remote: $REMOTE_SHA"
echo "  base  : $BASE_SHA"

# ---------------------------------------------------------------------------
# Mock binaries
# ---------------------------------------------------------------------------
MOCK_BIN="$WORK_DIR/bin"
mkdir "$MOCK_BIN"

# --- mock curl: always return 200 for any call ---
cat > "$MOCK_BIN/curl" << 'EOF'
#!/bin/bash
# Parse -o <file> and write empty JSON; print 200 for -w "%{http_code}"
OUTPUT_FILE=""
args=("$@")
i=0
while [ $i -lt ${#args[@]} ]; do
  if [ "${args[$i]}" = "-o" ]; then
    i=$((i + 1))
    OUTPUT_FILE="${args[$i]}"
  fi
  i=$((i + 1))
done

if [ -n "$OUTPUT_FILE" ]; then
  echo '{}' > "$OUTPUT_FILE"
fi
printf '200'
EOF
chmod +x "$MOCK_BIN/curl"

# --- mock git: intercept fetch, remote, push; forward everything else ---
REAL_GIT_PATH="$REAL_GIT"
PUSH_LOG_PATH="$PUSH_LOG"
LOCAL_REPO_PATH="$LOCAL_REPO"

cat > "$MOCK_BIN/git" << EOF
#!/bin/bash
REAL_GIT="$REAL_GIT_PATH"
PUSH_LOG="$PUSH_LOG_PATH"

CMD="\${1:-}"

case "\$CMD" in
  fetch)
    # no-op: diverged state is already staged; don't let the script
    # overwrite origin/main by fetching from the (now inaccessible) github URL.
    echo "Mock git fetch: no-op (preserving staged diverged state)"
    exit 0
    ;;
  remote)
    # no-op: prevent the script from rewriting the remote URL to github.com
    echo "Mock git remote: no-op"
    exit 0
    ;;
  push)
    echo "PUSH_CALLED: git push \$*" >> "\$PUSH_LOG"
    echo "Mock git push: BLOCKED by test (should not reach this path)" >&2
    exit 1
    ;;
  *)
    exec "\$REAL_GIT" "\$@"
    ;;
esac
EOF
chmod +x "$MOCK_BIN/git"

# ---------------------------------------------------------------------------
# Run the sync script from inside the local repo
# ---------------------------------------------------------------------------
cd "$LOCAL_REPO"

export PATH="$MOCK_BIN:$PATH"
export GITHUB_TOKEN="mock-token-for-test"

echo ""
echo "[run] Executing sync-to-github.sh..."
echo "--------------------------------------"

SYNC_OUTPUT=$("$SYNC_SCRIPT" 2>&1) || SYNC_EXIT=$?
SYNC_EXIT=${SYNC_EXIT:-0}

echo "$SYNC_OUTPUT"
echo "--------------------------------------"
echo "[run] Exit code: $SYNC_EXIT"
echo ""

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------
FAIL=0

# 1. Must exit non-zero
if [ "$SYNC_EXIT" -eq 0 ]; then
  echo "FAIL: Expected non-zero exit code, got 0"
  FAIL=1
else
  echo "PASS: Exit code is $SYNC_EXIT (non-zero)"
fi

# 2. Output must mention diverged histories
if echo "$SYNC_OUTPUT" | grep -qi "diverged"; then
  echo "PASS: Output contains divergence error message"
else
  echo "FAIL: Output does not contain 'diverged' — error message missing"
  FAIL=1
fi

# 3. git push must NOT have been called
if [ -s "$PUSH_LOG" ]; then
  echo "FAIL: git push was called — push log:"
  cat "$PUSH_LOG"
  FAIL=1
else
  echo "PASS: git push was never called"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "ALL TESTS PASSED"
  exit 0
else
  echo "SOME TESTS FAILED"
  exit 1
fi
