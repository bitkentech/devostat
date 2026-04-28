# Plan 33: Extract SessionStart hook script + generate hooks.json via JTE

## Context

`plugin-resources/src/main/resources/hooks/hooks.json` has a `"command"` field containing
~600 chars of semicolon-chained bash on a single line. It is unreadable, untestable directly,
and requires Maven `@...@` filtering to substitute three tokens at build time.

Two improvements:
1. **Extract the inline bash into `session-start.sh`** bundled with the plugin. The `"command"`
   field becomes a short env-var-plus-invocation one-liner.
2. **Generate `hooks.json` via JTE** (plugin-skill module), matching the pattern established for
   `SKILL.md` in Plan 32. Maven filtering of hooks.json is removed entirely.

**Backlog issue:** Build-infrastructure improvement. Tracking locally only.

---

## Design

### How the new command field looks (rendered from JTE)

```json
"command": "VERSION=0.2.0; CACHE_BASE=~/.cache/shipsmooth-dev; bash \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh\""
```

- `VERSION` and `CACHE_BASE` are baked in by JTE at build time (from `pluginVersion` and `cacheDir`).
- `${CLAUDE_PLUGIN_ROOT}` is a shell variable resolved at runtime by Claude Code.
- `session-start.sh` replaces `if [ -d @shipsmooth.jlink.dir@ ]` with `if [ -d "${CLAUDE_PLUGIN_ROOT}/runtime" ]`,
  so the dev build must copy the jlink image to `build/runtime/` (plugin-dist handles this).

### Module responsibilities after the change

| Output file | Who writes it | Phase |
|---|---|---|
| `build/hooks/hooks.json` | plugin-skill (JTE → ResourceBuilder) | compile |
| `build/hooks/session-start.sh` | plugin-resources (unfiltered copy) | process-resources |
| `build/runtime/` | plugin-dist dev profile (copy jlink image) | process-resources |

---

## Tasks

### Task 1: Write session-start.sh [High]

Create `plugin-resources/src/main/resources/hooks/session-start.sh`.

Reads `VERSION`, `CACHE_BASE`, and `CLAUDE_PLUGIN_ROOT` from env (set by the caller in hooks.json).
Replaces `if [ -d @shipsmooth.jlink.dir@ ]` with `if [ -d "${CLAUDE_PLUGIN_ROOT}/runtime" ]`.
Use `#!/bin/sh` (no bash-specific syntax in the original).

Full logic is identical to the current inline script, just formatted across lines:
- Check `${CACHE_BASE}/runtime-${VERSION}/bin/shipsmooth-tasks` exists — exit if so (idempotent).
- Detect OS/ARCH via `uname`; exit 1 if not `linux-x64`.
- If `${CLAUDE_PLUGIN_ROOT}/runtime` dir exists → copy it to cache, `chmod 755` the binary.
- Else → `curl` + `unzip` from GitHub releases into cache.

### Task 2: Add hooks.jte.md template [Medium]

Create `plugin-skill/src/main/jte-src/hooks/hooks.jte.md`.

JTE template producing valid JSON. `${model.pluginVersion()}` and `${model.cacheDir()}` are
interpolated at build time. `${CLAUDE_PLUGIN_ROOT}` must be written as a JTE raw literal:
use `${"${"}CLAUDE_PLUGIN_ROOT}` (same idiom as SKILL.jte.md uses for shell variables).

Template skeleton:
```
@import com.github.pramodbiligiri.shipsmooth.resources.PluginModel
@param PluginModel model
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "VERSION=${model.pluginVersion()}; CACHE_BASE=${model.cacheDir()}; bash \"${"${"}CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh\""
          }
        ]
      }
    ]
  }
}
```

The antrun glob (`*.jte.md` → `*.jte`) already covers files in subdirs — no antrun change needed.
JTE template name for `engine.render()` will be `"hooks/hooks.jte"`.

### Task 3: Extend PluginModel + ResourceBuilder [Low]

**`PluginModel.java`:** Add `jlinkDir` as a new last field (keeps the record complete even though
hooks.jte.md doesn't use it).

**`ResourceBuilder.java`:**
- Read `String jlinkDir = System.getProperty("shipsmooth.jlink.dir", "");`
- Pass it to the `PluginModel` constructor.
- Add a second render call after SKILL.md:
  ```java
  Path hooksDir = Path.of(buildOutputDir, "hooks");
  Files.createDirectories(hooksDir);
  renderTo(engine, "hooks/hooks.jte", model, hooksDir.resolve("hooks.json"));
  ```

### Task 4: Wire shipsmooth.jlink.dir into plugin-skill/pom.xml [Low]

Add to the `render-plugin-resources` exec-maven-plugin `<systemProperties>` block:

```xml
<systemProperty>
  <key>shipsmooth.jlink.dir</key>
  <value>${shipsmooth.jlink.dir}</value>
</systemProperty>
```

Root pom already defines `shipsmooth.jlink.dir` in dev and prod profiles.

### Task 5: Update plugin-resources/pom.xml [Low]

In the `claude` profile:
- **Remove** the `copy-hooks` execution (Maven-filtered hooks.json copy).
- **Add** `copy-session-start-script` — unfiltered copy of `session-start.sh` to `${build.outputDir}/hooks/`.
- **Delete** `plugin-resources/src/main/resources/hooks/hooks.json` (replaced by JTE template).

### Task 6: Copy jlink image to build/runtime/ in plugin-dist dev profile [Low]

Add a `maven-resources-plugin` execution to the `dev` profile in `plugin-dist/pom.xml` (after the
existing `verify-jlink-image-exists` antrun check):

```xml
<execution>
  <id>copy-jlink-runtime</id>
  <phase>process-resources</phase>
  <goals><goal>copy-resources</goal></goals>
  <configuration>
    <outputDirectory>${build.outputDir}/runtime</outputDirectory>
    <resources>
      <resource>
        <directory>${shipsmooth.jlink.dir}</directory>
        <filtering>false</filtering>
      </resource>
    </resources>
  </configuration>
</execution>
```

`session-start.sh` does `chmod 755 ${RUNTIME_DIR}/bin/shipsmooth-tasks` after the `cp -r`, so
permission bits on the copied binary are fixed at install time.

### Task 7: Add JUnit tests for hooks.json rendering [Low]

Add to `ResourceBuilderIntegrationTest.java`:
- `hooksJsonIsRenderedForDevProfile()` — verifies `hooks/hooks.json` contains `VERSION=0.2.0`,
  `CACHE_BASE=~/.cache/shipsmooth-dev`, and `${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh`.
- `hooksJsonIsRenderedForProdProfile()` — verifies `VERSION=0.2.0`, `CACHE_BASE=~/.cache/shipsmooth`.

### Task 8: Migrate bash test to invoke session-start.sh directly [Low]

Update `plugin-resources/src/test/test-session-start-hook.sh`:
- **Remove** the Node.js extraction block (lines 44–48).
- Set `HOOK_FILE="./build/hooks/session-start.sh"` directly.
- Each test invocation must now set `VERSION` and `CACHE_BASE` in the env:
  ```bash
  OUT=$(VERSION="0.2.0" CACHE_BASE="$HOME_DIR/.cache/shipsmooth-dev" \
        CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT" HOME="$HOME_DIR" PATH="$SHIM_DIR:$PATH" \
        bash "$HOOK_FILE" 2>&1)
  ```
- Remove the `rm -f "$HOOK_FILE"` at the end (no longer a temp file).
- Keep all three test cases and assertions unchanged.

---

## Risk Analysis

| Task | Risk | Justification |
|---|---|---|
| Task 1: session-start.sh | High | First time the hook invocation pattern changes; `${CLAUDE_PLUGIN_ROOT}` availability at runtime is an untested assumption |
| Task 2: hooks.jte.md | Medium | JTE `${"${"}...}` escaping for shell vars needs verification; JSON must stay valid |
| Tasks 3–8 | Low | Wiring and test migration; no new logic |

---

## Verification

1. `mvn package` (dev profile, default) — must succeed cleanly.
2. `cat build/hooks/hooks.json` — confirm `VERSION=0.2.0`, correct `CACHE_BASE`, and
   `${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh` in the command string.
3. `ls build/hooks/session-start.sh build/runtime/bin/shipsmooth-tasks` — both must exist.
4. `bash plugin-resources/src/test/test-session-start-hook.sh` — all 3 tests pass (from repo root, after dev build).
5. `mvn test -pl plugin-skill` — all JUnit tests green including the two new hooks.json tests.
6. `mvn package -Pprod,!dev` — succeeds; `build/hooks/hooks.json` has `CACHE_BASE=~/.cache/shipsmooth`; no `build/runtime/` directory created.