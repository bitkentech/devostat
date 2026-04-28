#!/usr/bin/env bash
# Tests for the SessionStart hook logic.
# Run from repo root: bash plugin-resources/src/test/test-session-start-hook.sh

set -euo pipefail

PASS=0
FAIL=0

assert_exit() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (expected exit $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_output_contains() {
  local desc="$1" pattern="$2" output="$3"
  if echo "$output" | grep -q "$pattern"; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (expected output to contain '$pattern', got: $output)"
    FAIL=$((FAIL + 1))
  fi
}

# Extract the hook script from hooks.json
HOOK_SCRIPT=$(node -e "const h=require('./plugin-resources/src/main/resources/hooks/hooks.json'); console.log(h.hooks.SessionStart[0].hooks[0].command)")
HOOK_FILE=$(mktemp /tmp/test-hook-XXXXXX.sh)
echo "#!/bin/sh" > "$HOOK_FILE"
echo "$HOOK_SCRIPT" >> "$HOOK_FILE"
chmod +x "$HOOK_FILE"

# ---- Test 1: dev short-circuit (in-tree runtime exists) ----
PLUGIN_ROOT=$(mktemp -d)
mkdir -p "$PLUGIN_ROOT/runtime/bin"
echo '#!/bin/sh' > "$PLUGIN_ROOT/runtime/bin/shipsmooth-tasks"
chmod +x "$PLUGIN_ROOT/runtime/bin/shipsmooth-tasks"
# Create a minimal plugin.json
mkdir -p "$PLUGIN_ROOT/.claude-plugin"
echo '{"version":"0.2.0"}' > "$PLUGIN_ROOT/.claude-plugin/plugin.json"

set +e
OUT=$(CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="/tmp" bash "$HOOK_FILE" 2>&1)
EXIT=$?
set -e
rm -rf "$PLUGIN_ROOT"
assert_exit "dev short-circuit exits 0" 0 "$EXIT"

# ---- Test 2: non-Linux platform exits 1 with clear message ----
PLUGIN_ROOT=$(mktemp -d)
mkdir -p "$PLUGIN_ROOT/.claude-plugin"
echo '{"version":"0.2.0"}' > "$PLUGIN_ROOT/.claude-plugin/plugin.json"
CACHE_DIR=$(mktemp -d)

# Create uname shims that report darwin/arm64
SHIM_DIR=$(mktemp -d)
printf '#!/bin/sh\nif [ "$1" = "-s" ]; then echo Darwin; elif [ "$1" = "-m" ]; then echo arm64; fi\n' > "$SHIM_DIR/uname"
chmod +x "$SHIM_DIR/uname"

set +e
OUT=$(CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="$CACHE_DIR" PATH="$SHIM_DIR:$PATH" bash "$HOOK_FILE" 2>&1)
EXIT=$?
set -e
rm -rf "$PLUGIN_ROOT" "$CACHE_DIR" "$SHIM_DIR"

assert_exit "non-Linux exits 1" 1 "$EXIT"
assert_output_contains "non-Linux shows platform name" "darwin-arm64" "$OUT"
assert_output_contains "non-Linux shows not-supported message" "not yet supported" "$OUT"

# ---- Test 3: runtime already cached — hook is idempotent (exits 0, no download attempt) ----
PLUGIN_ROOT=$(mktemp -d)
mkdir -p "$PLUGIN_ROOT/.claude-plugin"
echo '{"version":"0.2.0"}' > "$PLUGIN_ROOT/.claude-plugin/plugin.json"
CACHE_DIR=$(mktemp -d)
RUNTIME_DIR="$CACHE_DIR/.cache/shipsmooth/runtime-0.2.0"
mkdir -p "$RUNTIME_DIR/bin"
echo '#!/bin/sh' > "$RUNTIME_DIR/bin/shipsmooth-tasks"
chmod +x "$RUNTIME_DIR/bin/shipsmooth-tasks"

# Shim that reports linux/x86_64
SHIM_DIR=$(mktemp -d)
printf '#!/bin/sh\nif [ "$1" = "-s" ]; then echo Linux; elif [ "$1" = "-m" ]; then echo x86_64; fi\n' > "$SHIM_DIR/uname"
chmod +x "$SHIM_DIR/uname"

set +e
OUT=$(CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="$CACHE_DIR" PATH="$SHIM_DIR:$PATH" bash "$HOOK_FILE" 2>&1)
EXIT=$?
set -e
rm -rf "$PLUGIN_ROOT" "$CACHE_DIR" "$SHIM_DIR"
assert_exit "cached runtime exits 0 (idempotent)" 0 "$EXIT"

# ---- Summary ----
echo ""
echo "Results: $PASS passed, $FAIL failed"
rm -f "$HOOK_FILE"
[ "$FAIL" -eq 0 ]