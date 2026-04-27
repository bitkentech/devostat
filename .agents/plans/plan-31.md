# Plan 31 — Ship the Java CLI to Linux end users

## Context

- **Backlog issue:** `BL-002 — Replace Node.js task scripts with the Java CLI as the primary plugin runtime` (newly created for this plan; recorded below since this repo is in `[Local]` task-tracking mode and has no permanent Linear backlog).
- **Predecessor:** Plan 30 produced `shipsmooth-tasks-${VERSION}-linux-x64.zip` (~50MB) from the jlink image. That zip is currently a developer artifact; users never receive it.
- **Predecessor docs:** [docs/observations/2026-04-27-openj9-scc-startup-correction.md](../../docs/observations/2026-04-27-openj9-scc-startup-correction.md), [docs/decisions/2026-04-27-jlink-startup-optimisation.md](../../docs/decisions/2026-04-27-jlink-startup-optimisation.md).
- **Goal:** A Linux user installing the plugin via `/plugin install shipsmooth@bitkentech` ends up with the Java CLI at `~/.cache/shipsmooth/runtime-${VERSION}/bin/shipsmooth-tasks`, invoked by all task slash commands. The dev workflow (`mvn process-resources` + `extraKnownMarketplaces` directory source) works fully offline. macOS support is **explicitly out of scope** for this plan; a follow-up plan handles cross-build.

## Backlog issue (BL-002)

> **Title:** Replace Node.js task scripts with the Java CLI as the primary plugin runtime
>
> **Why:** The Java CLI is faster (~340ms cold start with OpenJ9 SCC vs Node+TS compile on every session), simpler to maintain (one codebase instead of two), and aligns with the long-term direction recorded in plan-28's decision doc. Today the plugin ships only Node.js; the Java CLI exists but is unreachable from the installed plugin.
>
> **Acceptance:** A Linux-x64 user installing the plugin via `/plugin install shipsmooth@bitkentech` ends up with `~/.cache/shipsmooth/runtime-${VERSION}/bin/shipsmooth-tasks` populated by SessionStart and invoked by all task slash commands. The dev workflow works fully offline with no GitHub release dependency. macOS users get a clear "not yet supported" error message; multi-platform support is delivered in a follow-up plan.

## Decisions (confirmed with user)

- **Failure mode:** SessionStart hard-fails with a clear actionable message if the runtime download fails. No Node.js fallback.
- **Cache location:** `~/.cache/shipsmooth/runtime-${VERSION}/`. Global, survives plugin reinstalls, downloaded once per machine per version.
- **Platform scope:** Linux-x64 only for this plan. Hook detects macOS/arm64 and emits a clear "platform not yet supported" error rather than silently 404-ing on download. Cross-build deferred to a follow-up plan; worst case fallback is a GitHub Actions matrix.
- **Dev workflow:** Fully offline. `mvn process-resources` (default `dev` profile) populates `build/runtime/` with the locally-built jlink image. The `extraKnownMarketplaces` directory source serves the plugin from `build/`, and the SessionStart hook detects the in-tree runtime and skips download entirely. Production builds (`-Pprod`) never include `build/runtime/`, so production users always hit the download path.

## Architecture

### Build side (release.sh, Linux-only)

```
1.  Clean working tree check                             [unchanged]
2.  mvn versions:set + commit                            [unchanged]
3.  rm -rf build/                                        [unchanged]
4.  mvn process-resources -Pprod                         [unchanged]
5.  jq stamp version into plugin.json                    [unchanged]
--- NEW (still on original branch) ---
6.  mvn -pl plugin-tasks-java -am -Pjlink package
    ./scripts/package-tasks-java.sh
    Assert plugin-tasks-java/target/dist/shipsmooth-tasks-${VERSION}-linux-x64.zip exists
-----------------------------------------
7.  git checkout releases                                [unchanged]
8.  Copy build/ to dist/, commit, tag                    [unchanged]
9.  git push origin releases "$TAG"                      [unchanged]
10. gh release create ...                                [unchanged]
--- NEW ---
11. gh release upload "$TAG" <linux-x64 zip>
12. rm -rf plugin-tasks-java/target/dist
-----------------------------------------
13. git checkout "$ORIGINAL_BRANCH"                      [unchanged]
```

The `releases` branch ships **only** the thin Node launcher (`dist/scripts/tasks/*.js`), hooks, skills, and `plugin.json`. No binaries — they live on GitHub release assets, downloaded on demand.

### Install side (SessionStart hook)

```bash
# Dev mode: if the plugin ships a runtime in-tree (only true for -Pdev local builds),
# use it directly. No download, no cache, fully offline.
if [ -x "${CLAUDE_PLUGIN_ROOT}/runtime/bin/shipsmooth-tasks" ]; then
  exit 0
fi

# Prod mode: download the platform-specific runtime to ~/.cache/shipsmooth/.
VERSION=$(jq -r .version "${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json")
RUNTIME_DIR="${HOME}/.cache/shipsmooth/runtime-${VERSION}"

if [ ! -x "${RUNTIME_DIR}/bin/shipsmooth-tasks" ]; then
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)
  case "$ARCH" in x86_64) ARCH=x64 ;; arm64|aarch64) ARCH=arm64 ;; esac
  if [ "$OS-$ARCH" != "linux-x64" ]; then
    echo "shipsmooth: platform $OS-$ARCH is not yet supported (linux-x64 only at this release)" >&2
    echo "shipsmooth: cross-platform builds are tracked as a follow-up; see plan-31" >&2
    exit 1
  fi
  URL="https://github.com/bitkentech/shipsmooth/releases/download/v${VERSION}/shipsmooth-tasks-${VERSION}-linux-x64.zip"
  TMP=$(mktemp -d)
  curl -fsSL "$URL" -o "${TMP}/runtime.zip" || {
    echo "shipsmooth: failed to download runtime from $URL" >&2
    echo "shipsmooth: check network access to github.com and that the release exists" >&2
    rm -rf "$TMP"; exit 1
  }
  mkdir -p "${RUNTIME_DIR}.tmp"
  unzip -q "${TMP}/runtime.zip" -d "${RUNTIME_DIR}.tmp" || {
    echo "shipsmooth: failed to extract runtime zip" >&2
    rm -rf "$TMP" "${RUNTIME_DIR}.tmp"; exit 1
  }
  mv "${RUNTIME_DIR}.tmp/shipsmooth-tasks-${VERSION}" "${RUNTIME_DIR}"
  rm -rf "${RUNTIME_DIR}.tmp" "$TMP"
  echo "shipsmooth: runtime ${VERSION} installed at ${RUNTIME_DIR}"
fi
```

### Runtime: thin Node launchers replace direct logic

The `dist/scripts/tasks/*.js` files become thin wrappers that exec the Java CLI. They check the same two locations the hook does, in the same order:

```js
#!/usr/bin/env node
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = process.env.CLAUDE_PLUGIN_ROOT;
const devBin = path.join(root, 'runtime', 'bin', 'shipsmooth-tasks');
let bin;
if (fs.existsSync(devBin)) {
  bin = devBin;
} else {
  const VERSION = require(path.join(root, '.claude-plugin', 'plugin.json')).version;
  bin = path.join(process.env.HOME, '.cache', 'shipsmooth', `runtime-${VERSION}`, 'bin', 'shipsmooth-tasks');
}

const subcommand = path.basename(process.argv[1], '.js');
try {
  execFileSync(bin, [subcommand, ...process.argv.slice(2)], { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
```

These wrappers stay until the plugin manifest can directly reference the binary (out of scope).

## Risk-sorted tasks

### Task 1: -Pdev profile copies jlink image into build/runtime/ [Low]

**Default Risk: Low.** Mechanical Maven config. The `dev` profile in the root `pom.xml` (or `plugin-dist/pom.xml`) gains a step that triggers the local jlink build (`mvn -pl plugin-tasks-java -am -Pjlink package`, host-platform only) and copies `plugin-tasks-java/target/jlink-image/` to `build/runtime/`. The `prod` profile must NOT do this — production assets are downloaded. This is sequenced first (despite being Low risk) because subsequent tasks can't be tested in the dev workflow without it.

**Files touched:** `pom.xml` (dev profile), possibly `plugin-dist/pom.xml`.

### Task 2: SessionStart hook — dev short-circuit plus Linux download path [Medium]

**Default Risk: Medium.** Failure breaks the plugin for all users. Replace the current TS-compile hook with the logic above. The dev short-circuit (in-tree `runtime/bin/shipsmooth-tasks` check) goes first so dev users hit no network. The download path is gated to `linux-x64`; non-Linux platforms get a clear "not yet supported" error. Idempotency: re-running a session must not re-download.

**Files touched:** `plugin-resources/src/main/resources/hooks/hooks.json`.

### Task 3: Convert Node.js task scripts to thin Java CLI wrappers [Medium]

**Default Risk: Medium.** All scripts must agree on the subcommand-name convention (file basename → CLI subcommand) and arg passthrough. Replace the body of each `plugin-node/src/main/scripts/tasks/*.ts` with the exec-the-binary pattern. Keep TypeScript types so `tsc` still compiles. The existing unit tests exercise Node.js logic that no longer lives there — convert them to integration tests that exec the wrapper and assert on stdout/exit code, or move them into the Java module's test suite.

**Files touched:** `plugin-node/src/main/scripts/tasks/{init,show,update-status,add-comment,add-deviation,set-commit,project-update}.ts` and the corresponding `*.test.ts` files.

### Task 4: Wire Linux jlink build into release.sh [Medium]

**Default Risk: Medium.** Bash plumbing, but a failure midway leaves a partial release. Insert the jlink build + packaging step on the original branch (before `git checkout releases`) so any failure aborts before touching the orphan branch. Use a separate `gh release upload` call (not appended to `gh release create`) so a 50MB-zip upload timeout doesn't require re-creating the release.

**Files touched:** `scripts/release.sh`.

### Task 5: End-to-end install test [Low]

**Default Risk: Low.** Pure verification, no code changes.

**Dev path (offline):** `mvn process-resources` populates `build/runtime/`; with `extraKnownMarketplaces` pointing at `build/`, start a Claude session, observe the hook short-circuits, exercise a slash command, confirm the Java CLI runs from `build/runtime/`.

**Prod path:** push a real release tag, `rm -rf ~/.cache/shipsmooth/`, install via `/plugin install`, confirm the runtime downloads to `~/.cache/shipsmooth/runtime-${VERSION}/`, exercise a slash command, restart the session and confirm idempotency. Confirm a macOS session (or a faked `uname` shim) emits the "not yet supported" error.

**Files touched:** none.

## Execution order

Risk-descending would be 2, 3, 4 → 1, 5. Dependency-respecting reordering:

- Task 1 must precede Tasks 2 and 3 (they need `build/runtime/` to test the dev path)
- Task 5 is verification, runs last

**Final order: 1 → 2 → 3 → 4 → 5.**

## Verification

**Fast iteration via `-Pdev` (development workflow, fully offline):**
1. `mvn process-resources` — produces `build/` with `runtime/` populated from the local jlink image (per Task 1)
2. With `extraKnownMarketplaces` pointing at `build/` and `shipsmooth-dev` enabled in `~/.claude/settings.json` (per DEVELOPMENT.md), start a new Claude session
3. Hook detects `${CLAUDE_PLUGIN_ROOT}/runtime/bin/shipsmooth-tasks`, exits early, no download
4. Exercise the slash commands — they invoke the Java CLI from `build/runtime/`
5. Edit code, re-run `mvn process-resources`, restart Claude — picks up changes, still no network

**Production end-to-end on Linux (after a real release tag is published):**
1. `rm -rf ~/.cache/shipsmooth/`
2. Disable `shipsmooth-dev` and enable `shipsmooth@bitkentech` in `~/.claude/settings.json`
3. From a fresh project, `/plugin marketplace update && /plugin install shipsmooth@bitkentech`
4. Start a new session — observe `shipsmooth: runtime X.Y.Z installed at ~/.cache/shipsmooth/runtime-X.Y.Z`
5. Confirm `${CLAUDE_PLUGIN_ROOT}/runtime/` does NOT exist (prod build excludes it) so the download path is what's exercised
6. Run a subcommand that exercises the Java CLI — should produce expected output
7. Restart session — hook should be silent (idempotent, runtime cached)
8. Bump plugin to `X.Y.(Z+1)` — hook downloads new runtime alongside old one (no removal, no upgrade conflict)

**Non-Linux behavior on Linux dev box:** spoof `uname -s`/`uname -m` via a shim on `$PATH` to confirm the platform check emits the right error and exits 1.

## Risks

1. **Dev profile triggering the jlink build slows down `mvn process-resources` significantly** (~30-60s for the Maven build vs ~5s today). Mitigate: the dev profile only rebuilds `runtime/` if `plugin-tasks-java/target/jlink-image/` is missing or older than its sources, so steady-state dev iteration stays fast.
2. **Plugin manifest can't reference the binary directly** (current `.js`-only constraint). Thin wrappers stay until the plugin schema evolves. Not a blocker.
3. **`~/.cache/shipsmooth/` accumulates old runtime versions.** Acceptable — disk is cheap. Cleanup is a follow-up.
4. **Cross-platform users blocked.** Explicit non-goal of this plan; clear error message keeps the failure mode obvious. Follow-up plan handles macOS via cross-build spike or GitHub Actions matrix.

## References

- [docs/observations/2026-04-27-openj9-scc-startup-correction.md](../../docs/observations/2026-04-27-openj9-scc-startup-correction.md)
- [docs/decisions/2026-04-27-jlink-startup-optimisation.md](../../docs/decisions/2026-04-27-jlink-startup-optimisation.md)
- [.agents/plans/plan-28.md](plan-28.md), [.agents/plans/plan-30.md](plan-30.md) — predecessor plans
- [DEVELOPMENT.md](../../DEVELOPMENT.md) — `extraKnownMarketplaces` dev workflow
- `pom.xml` (dev profile) — Task 1
- `plugin-resources/src/main/resources/hooks/hooks.json` — Task 2
- `plugin-node/src/main/scripts/tasks/*.ts` — Task 3
- `scripts/release.sh` — Task 4
