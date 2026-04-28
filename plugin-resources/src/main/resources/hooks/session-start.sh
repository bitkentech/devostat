#!/bin/sh
# SessionStart hook for shipsmooth.
# Invoked as: VERSION=<ver> CACHE_BASE=<dir> bash "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"
# Env vars set by hooks.json command: VERSION, CACHE_BASE, CLAUDE_PLUGIN_ROOT

set -e

RUNTIME_DIR="${CACHE_BASE}/runtime-${VERSION}"

if [ ! -x "${RUNTIME_DIR}/bin/shipsmooth-tasks" ]; then
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  case $ARCH in
    x86_64)        ARCH=x64 ;;
    arm64|aarch64) ARCH=arm64 ;;
  esac

  if [ "$OS-$ARCH" != "linux-x64" ]; then
    echo "shipsmooth: platform $OS-$ARCH is not yet supported" >&2
    exit 1
  fi

  JLINK_SRC="${CLAUDE_PLUGIN_ROOT}/runtime"
  if [ -d "$JLINK_SRC" ]; then
    mkdir -p "${RUNTIME_DIR}"
    cp -r "$JLINK_SRC/." "${RUNTIME_DIR}/"
    chmod 755 "${RUNTIME_DIR}/bin/shipsmooth-tasks"
    echo "shipsmooth: runtime ${VERSION} installed at ${RUNTIME_DIR} from local build"
  else
    URL="https://github.com/bitkentech/shipsmooth/releases/download/v${VERSION}/shipsmooth-tasks-${VERSION}-linux-x64.zip"
    TMP=$(mktemp -d)
    curl -fsSL "$URL" -o "${TMP}/runtime.zip" || {
      echo "shipsmooth: failed to download runtime" >&2
      rm -rf "$TMP"
      exit 1
    }
    mkdir -p "${RUNTIME_DIR}.tmp"
    unzip -q "${TMP}/runtime.zip" -d "${RUNTIME_DIR}.tmp" || {
      echo "shipsmooth: failed to extract runtime zip" >&2
      rm -rf "$TMP" "${RUNTIME_DIR}.tmp"
      exit 1
    }
    mv "${RUNTIME_DIR}.tmp/shipsmooth-tasks-${VERSION}" "${RUNTIME_DIR}"
    rm -rf "${RUNTIME_DIR}.tmp" "$TMP"
    echo "shipsmooth: runtime ${VERSION} installed at ${RUNTIME_DIR}"
  fi
fi