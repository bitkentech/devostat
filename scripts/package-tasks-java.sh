#!/usr/bin/env bash
# package-tasks-java.sh — Build a self-contained shippable zip of plugin-tasks-java.
#
# Output: plugin-tasks-java/target/dist/shipsmooth-tasks-<version>-linux-x64.zip
#
# The zip contains:
#   - jre/        IBM Semeru OpenJ9 JRE 25 (~175MB extracted)
#   - lib/        app jar + runtime dependency jars
#   - bin/        install-relative launcher with -Xquickstart and -Xshareclasses
#
# Recipient extracts the zip and runs bin/shipsmooth-tasks. SCC cache is written
# under ${XDG_CACHE_HOME:-$HOME/.cache}/shipsmooth/scc/ on first invocation.
#
# Usage: ./scripts/package-tasks-java.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODULE_DIR="${REPO_ROOT}/plugin-tasks-java"
TARGET_DIR="${MODULE_DIR}/target"
DIST_DIR="${TARGET_DIR}/dist"

JRE_SRC="/opt/installers/jre-semeru/jdk-25.0.2+10-jre"

cd "$REPO_ROOT"

VERSION=$(mvn -pl plugin-tasks-java -q help:evaluate -Dexpression=project.version -DforceStdout 2>/dev/null | tail -1)
STAGE_NAME="shipsmooth-tasks-${VERSION}"
STAGE_DIR="${DIST_DIR}/${STAGE_NAME}"
ZIP_PATH="${DIST_DIR}/${STAGE_NAME}-linux-x64.zip"

echo "==> Verifying prerequisites..."
[[ -x "${JRE_SRC}/bin/java" ]] || { echo "Error: Semeru JRE not found at ${JRE_SRC}" >&2; exit 1; }
[[ -f "${TARGET_DIR}/plugin-tasks-java-${VERSION}.jar" ]] || {
  echo "Error: plugin-tasks-java-${VERSION}.jar not found. Run 'mvn -pl plugin-tasks-java -am -Pjlink package' first." >&2
  exit 1
}

echo "==> Resolving runtime dependencies via mvn dependency:build-classpath..."
DEPS_FILE=$(mktemp)
trap 'rm -f "$DEPS_FILE"' EXIT
mvn -pl plugin-tasks-java -q dependency:build-classpath \
  -DincludeScope=runtime \
  -Dmdep.outputFile="$DEPS_FILE"
DEPS_CP=$(cat "$DEPS_FILE")

echo "==> Cleaning ${DIST_DIR}..."
rm -rf "$DIST_DIR"
mkdir -p "$STAGE_DIR/bin" "$STAGE_DIR/lib"

echo "==> Copying Semeru JRE..."
cp -r "$JRE_SRC" "$STAGE_DIR/jre"

echo "==> Copying app jar and dependencies into lib/..."
cp "${TARGET_DIR}/plugin-tasks-java-${VERSION}.jar" "$STAGE_DIR/lib/"
IFS=':' read -ra DEP_PATHS <<< "$DEPS_CP"
for jar in "${DEP_PATHS[@]}"; do
  cp "$jar" "$STAGE_DIR/lib/"
done

echo "==> Writing install-relative launcher..."
cat > "$STAGE_DIR/bin/shipsmooth-tasks" <<'LAUNCHER'
#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL="$(cd "$DIR/.." && pwd)"
SCC_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/shipsmooth/scc"
mkdir -p "$SCC_DIR"

MODULE_PATH=""
for jar in "$INSTALL"/lib/*.jar; do
  if [ -z "$MODULE_PATH" ]; then
    MODULE_PATH="$jar"
  else
    MODULE_PATH="$MODULE_PATH:$jar"
  fi
done

exec "$INSTALL/jre/bin/java" \
  -Xquickstart \
  -Xshareclasses:name=shipsmooth_v__VERSION__,cacheDir="$SCC_DIR",nonfatal \
  --module-path "$MODULE_PATH" \
  -m com.github.pramodbiligiri.shipsmooth.tasks/com.github.pramodbiligiri.shipsmooth.tasks.TasksCli "$@"
LAUNCHER

sed -i "s/__VERSION__/${VERSION}/" "$STAGE_DIR/bin/shipsmooth-tasks"
chmod 755 "$STAGE_DIR/bin/shipsmooth-tasks"

echo "==> Smoke-testing the staged launcher..."
"$STAGE_DIR/bin/shipsmooth-tasks" --help > /dev/null

echo "==> Creating ${ZIP_PATH}..."
( cd "$DIST_DIR" && zip -qr "$(basename "$ZIP_PATH")" "$STAGE_NAME" )

SIZE=$(du -h "$ZIP_PATH" | cut -f1)
echo ""
echo "Built: ${ZIP_PATH} (${SIZE})"
echo "Stage: ${STAGE_DIR}"
