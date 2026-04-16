#!/usr/bin/env bash
# Smoke test for the Gemini CLI extension build.
#
# What this tests:
#   1. mvn -P gemini,!dev,!claude package produces a valid build-gemini/ tree
#   2. gemini extensions link build-gemini/ succeeds
#   3. The linked extension appears in ~/.gemini/extensions/
#   4. scripts/test-gemini-hook.sh passes (hook command logic)
#
# What this does NOT test (requires interactive gemini session):
#   - SessionStart hook actually firing in a live gemini session
#   - Skill activation and slash command registration
#   Use the manual verification steps in DEVELOPMENT.md for those.
#
# Usage: ./scripts/smoke-gemini.sh
# Prerequisites: gemini CLI installed via NVM v22 (see DEVELOPMENT.md)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GEMINI_BIN="/opt/nvm/versions/node/v22.22.2/bin/gemini"
BUILD_DIR="$REPO_ROOT/build-gemini"

echo "=== devostat Gemini smoke test ==="

# --- 1. Check prerequisites ---
if [[ ! -x "$GEMINI_BIN" ]]; then
  echo "SKIP: gemini CLI not found at $GEMINI_BIN"
  echo "      Install via: nvm install 22 && npm install -g @google/gemini-cli"
  exit 0
fi

echo "gemini: $($GEMINI_BIN --version 2>&1 | head -1)"

# --- 2. Build ---
echo ""
echo "--- Step 1: mvn -P gemini,!dev,!claude package ---"
cd "$REPO_ROOT"
mvn -P gemini,\!dev,\!claude process-resources -q
echo "Build output: $BUILD_DIR"

# Assert expected files exist
assert_file() {
  if [[ -f "$1" ]]; then
    echo "  PASS: $(basename $1)"
  else
    echo "  FAIL: $1 missing"
    exit 1
  fi
}

echo "--- Asserting build-gemini/ layout ---"
assert_file "$BUILD_DIR/gemini-extension.json"
assert_file "$BUILD_DIR/hooks/hooks.json"
assert_file "$BUILD_DIR/commands/devostat.toml"
assert_file "$BUILD_DIR/skills/devostat/SKILL.md"
assert_file "$BUILD_DIR/package.json"
assert_file "$BUILD_DIR/dist/init.js"
assert_file "$BUILD_DIR/dist/update-status.js"

# Assert SKILL.md has frontmatter
if head -1 "$BUILD_DIR/skills/devostat/SKILL.md" | grep -q "^---"; then
  echo "  PASS: SKILL.md has frontmatter"
else
  echo "  FAIL: SKILL.md missing frontmatter"
  exit 1
fi

# Assert SKILL.md uses ~/.cache/devostat/dist path
if grep -q "~/.cache/devostat/dist" "$BUILD_DIR/skills/devostat/SKILL.md"; then
  echo "  PASS: SKILL.md uses ~/.cache/devostat/dist path"
else
  echo "  FAIL: SKILL.md missing ~/.cache/devostat/dist path"
  exit 1
fi

# Assert hooks.json uses ${extensionPath} not ${CLAUDE_PLUGIN_ROOT}
if grep -q 'extensionPath' "$BUILD_DIR/hooks/hooks.json" && ! grep -q 'CLAUDE_PLUGIN_ROOT' "$BUILD_DIR/hooks/hooks.json"; then
  echo "  PASS: hooks.json uses \${extensionPath}"
else
  echo "  FAIL: hooks.json has wrong variable substitutions"
  exit 1
fi

# --- 3. Link extension ---
echo ""
echo "--- Step 2: gemini extensions link ---"
# Remove any existing devostat extension dir first (idempotent re-link)
rm -rf "$HOME/.gemini/extensions/devostat"
npm_config_cache="/opt/nvm/cache" npm_config_prefix="" \
  "$GEMINI_BIN" extensions link --consent "$BUILD_DIR" 2>&1 | tail -3

INSTALL_META="$HOME/.gemini/extensions/devostat/.gemini-extension-install.json"
if [[ -f "$INSTALL_META" ]]; then
  echo "  PASS: extension linked at ~/.gemini/extensions/devostat/"
  echo "  source: $(node -e "console.log(require('$INSTALL_META').source)")"
else
  echo "  FAIL: extension not linked — $INSTALL_META missing"
  exit 1
fi

# --- 4. Hook logic test ---
echo ""
echo "--- Step 3: hook logic test ---"
bash "$REPO_ROOT/scripts/test-gemini-hook.sh"

echo ""
echo "=== ALL SMOKE TESTS PASSED ==="
echo ""
echo "Next: start 'gemini' in a repo and verify:"
echo "  - SessionStart hook fires (devostat: deps installed)"
echo "  - /skills shows devostat"
echo "  - /devostat command is available"
