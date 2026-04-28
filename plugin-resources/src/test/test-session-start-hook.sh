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

assert_file_exists() {
  local desc="$1" path="$2"
  if [ -x "$path" ]; then
    echo "PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $desc (expected executable at $path)"
    FAIL=$((FAIL + 1))
  fi
}

HOOK_FILE="./build/hooks/session-start.sh"

# uname shim reporting linux/x86_64
make_linux_shim() {
  local dir="$1"
  printf '#!/bin/sh\nif [ "$1" = "-s" ]; then echo Linux; elif [ "$1" = "-m" ]; then echo x86_64; fi\n' > "$dir/uname"
  chmod +x "$dir/uname"
}

# ---- Test 1: dev path — in-tree runtime copied to cache ----
PLUGIN_ROOT=$(mktemp -d)
mkdir -p "$PLUGIN_ROOT/runtime/bin"
echo '#!/bin/sh' > "$PLUGIN_ROOT/runtime/bin/shipsmooth-tasks"
chmod +x "$PLUGIN_ROOT/runtime/bin/shipsmooth-tasks"
HOME_DIR=$(mktemp -d)
SHIM_DIR=$(mktemp -d)
make_linux_shim "$SHIM_DIR"

set +e
OUT=$(VERSION="0.2.0" CACHE_BASE="$HOME_DIR/.cache/shipsmooth-dev" \
      CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="$HOME_DIR" PATH="$SHIM_DIR:$PATH" \
      bash "$HOOK_FILE" 2>&1)
EXIT=$?
set -e

assert_exit "dev: in-tree runtime exits 0" 0 "$EXIT"
assert_output_contains "dev: reports local build install" "local build" "$OUT"
assert_file_exists "dev: binary copied to cache" "$HOME_DIR/.cache/shipsmooth-dev/runtime-0.2.0/bin/shipsmooth-tasks"
rm -rf "$PLUGIN_ROOT" "$HOME_DIR" "$SHIM_DIR"

# ---- Test 2: dev path — idempotent (already cached, no re-copy) ----
PLUGIN_ROOT=$(mktemp -d)
mkdir -p "$PLUGIN_ROOT/runtime/bin"
echo '#!/bin/sh' > "$PLUGIN_ROOT/runtime/bin/shipsmooth-tasks"
chmod +x "$PLUGIN_ROOT/runtime/bin/shipsmooth-tasks"
HOME_DIR=$(mktemp -d)
mkdir -p "$HOME_DIR/.cache/shipsmooth-dev/runtime-0.2.0/bin"
echo '#!/bin/sh' > "$HOME_DIR/.cache/shipsmooth-dev/runtime-0.2.0/bin/shipsmooth-tasks"
chmod +x "$HOME_DIR/.cache/shipsmooth-dev/runtime-0.2.0/bin/shipsmooth-tasks"
SHIM_DIR=$(mktemp -d)
make_linux_shim "$SHIM_DIR"

set +e
OUT=$(VERSION="0.2.0" CACHE_BASE="$HOME_DIR/.cache/shipsmooth-dev" \
      CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="$HOME_DIR" PATH="$SHIM_DIR:$PATH" \
      bash "$HOOK_FILE" 2>&1)
EXIT=$?
set -e

assert_exit "dev: already cached exits 0" 0 "$EXIT"
rm -rf "$PLUGIN_ROOT" "$HOME_DIR" "$SHIM_DIR"

# ---- Test 3: non-Linux platform exits 1 with clear message ----
PLUGIN_ROOT=$(mktemp -d)
HOME_DIR=$(mktemp -d)
SHIM_DIR=$(mktemp -d)
printf '#!/bin/sh\nif [ "$1" = "-s" ]; then echo Darwin; elif [ "$1" = "-m" ]; then echo arm64; fi\n' > "$SHIM_DIR/uname"
chmod +x "$SHIM_DIR/uname"

set +e
OUT=$(VERSION="0.2.0" CACHE_BASE="$HOME_DIR/.cache/shipsmooth-dev" \
      CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="$HOME_DIR" PATH="$SHIM_DIR:$PATH" \
      bash "$HOOK_FILE" 2>&1)
EXIT=$?
set -e
rm -rf "$PLUGIN_ROOT" "$HOME_DIR" "$SHIM_DIR"

assert_exit "non-Linux exits 1" 1 "$EXIT"
assert_output_contains "non-Linux shows platform name" "darwin-arm64" "$OUT"
assert_output_contains "non-Linux shows not-supported message" "not yet supported" "$OUT"

# ---- Summary ----
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]