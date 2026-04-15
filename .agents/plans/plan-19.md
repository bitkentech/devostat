# Plan 19 — Port devostat plugin to Gemini CLI

## Context

The devostat plugin currently ships as a Claude Code plugin (sources in `plugin-resources/src/main/resources/`, `plugin-node/`, `plugin-dist/`; Maven assembles into gitignored `build/`). When a long Claude Code session hits its token ceiling mid-workflow, the user wants to continue the same plan on Gemini CLI on the same repo. That requires the same skill, same slash command, same task scripts, and the same `.agents/plans/*.xml` format to be available there.

Gemini CLI extensions (stable as of the 2025 release) support every Claude Code primitive devostat uses: JSON manifest, `skills/NAME/SKILL.md`, `commands/*.toml` slash commands, `hooks/hooks.json` with `SessionStart`, and `mcpServers`. The skill-activation mechanism is even identical (frontmatter injected into system prompt; model calls `activate_skill`). The port is therefore a packaging exercise — no logic changes to the task scripts or skill body.

**Permanent backlog feature issue:** [PB-268 — *Multi-host plugin packaging (Claude Code + Gemini CLI)*](https://linear.app/pb-default/issue/PB-268/multi-host-plugin-packaging-claude-code-gemini-cli) in project *devostat — Backlog & Roadmap*. plan-19 is the first slice — the Gemini CLI target. Future hosts (Copilot CLI, Codex) can be added under the same backlog issue as separate plans.

### Build model

Existing Maven graph:

- `plugin-resources` — copies/filters `SKILL.md`, `plugin.json`, `marketplace.json`, `hooks.json` into `build/`.
- `plugin-node` — `npm install` + `tsc` to `plugin-node/dist/`.
- `plugin-dist` — aggregator; copies compiled JS + TS sources into `build/scripts/tasks/`.

Most module poms hardcode `${project.parent.basedir}/build/...` as their output directory. To emit a Gemini tree without duplicating Maven config, we parameterise the output directory (the root pom already declares `${build.outputDir}` — the modules just don't use it yet) and add a `gemini` profile that redirects to `build-gemini/` with a different resource set.

### Compatibility mapping (Claude Code → Gemini CLI)

| Claude Code | Gemini CLI | Change needed |
|---|---|---|
| `.claude-plugin/plugin.json` | `gemini-extension.json` at extension root | New file, new schema |
| `.claude-plugin/marketplace.json` | n/a | Skip — Gemini installs via git URL or local path |
| `skills/devostat/SKILL.md` | `skills/devostat/SKILL.md` | Identical content; SKILL.md frontmatter + auto-activation contract is the same on both hosts |
| `hooks/hooks.json` SessionStart | `hooks/hooks.json` SessionStart | Same schema; replace `${CLAUDE_PLUGIN_ROOT}` with `${extensionPath}` and `${CLAUDE_PLUGIN_DATA}` with a derived `$HOME/.cache/devostat/` path |
| Auto-generated `/devostat:devostat` command | Explicit `commands/devostat.toml` | Gemini doesn't auto-register a command per skill — author one |
| Linear MCP via user's `~/.claude/settings.json` | Linear MCP via `~/.gemini/settings.json` | User-level concern, out of scope for this plan — document in README only |

### Resolved decisions

- **Skill activation on Gemini:** On-demand only. Omit `contextFileName` from the manifest so SKILL.md is only injected via `activate_skill` when the model deems it relevant. Matches Claude Code; avoids burning context on every session.
- **Build output location:** `build-gemini/` is gitignored and produced by `mvn -P gemini package`. Not committed. Same pattern as `build/`.
- **Task tracking:** `[Local]` XML at `.agents/plans/plan-19-tasks.xml`, matching plans 17 and 18.
- **Coverage threshold:** 95% where tests exist. Most tasks are config/docs with no TDD surface — deviations will be recorded in the XML per task, same pattern as plan-18 task 1.

### Key risks

1. **`CLAUDE_PLUGIN_DATA` has no Gemini equivalent.** The existing SessionStart hook uses it to cache `node_modules` + compiled `dist/` in a writable location (the extension dir itself is read-only on Gemini). We must derive a host-agnostic cache dir. The skill body currently embeds the absolute path `/home/pramod/.claude/plugins/data/devostat-bitkentech/dist/` in script-invocation examples — that must be rewritten to a host-neutral `$DEVOSTAT_DIST` env var that each hook exports.
2. **Skill-body portability.** Beyond the cache path, the skill body says "Requires the plugin's SessionStart hook to have run (installs `fast-xml-parser` and compiles…)". This is still true on Gemini, but the wording currently implies Claude Code specifics.

---

## Risk-sorted tasks

Eight thin vertical slices, ordered High → Low. Task 0 is a **throwaway spike** — a hand-authored Gemini extension tree the user can inspect and install. If it works, Tasks 1–7 productionise it via Maven. If it doesn't, Tasks 1–7 get revised before committing to them. Each task ends on a green build and a committed rollback point.

### Task 0 — Hand-authored Gemini extension spike **[High]**

*Why High:* First contact with Gemini CLI's extension loader. Every assumption baked into Tasks 3–5 (manifest shape, command TOML format, hook env-var substitution, skill auto-activation) is unverified until this runs end-to-end. If any assumption is wrong, the clean-build tasks get invalidated.

- Create a new top-level directory `gemini-extension-spike/` (gitignored — not a source tree Maven will process). Populate with files hand-authored from the current `build/` tree:
  - `gemini-extension-spike/gemini-extension.json` — manifest: `name: "devostat"`, `version: "0.1.6"` (match current plugin version), `description: "..."`. No `contextFileName`. No `mcpServers`.
  - `gemini-extension-spike/commands/devostat.toml` — single command. Body: `description = "Apply the devostat agent coding workflow."` + `prompt = "Activate the devostat skill and apply it to the user's current task."`
  - `gemini-extension-spike/skills/devostat/SKILL.md` — straight copy of `build/skills/devostat/SKILL.md`. Known issue: the hardcoded `/home/pramod/.claude/plugins/data/...` paths won't resolve in a Gemini session. We accept this for the spike — the point is to confirm the skill *auto-activates*, not that its scripts run. Note in the spike README why.
  - `gemini-extension-spike/hooks/hooks.json` — port of `build/hooks/hooks.json` with the two sed-level substitutions:
    - `${CLAUDE_PLUGIN_ROOT}` → `${extensionPath}`
    - `${CLAUDE_PLUGIN_DATA}` → `${HOME}/.cache/devostat-spike`
    - Add `mkdir -p "${HOME}/.cache/devostat-spike"` as the first shell operation so subsequent `cp` targets exist.
  - `gemini-extension-spike/package.json` — straight copy of `build/package.json` (needed by the hook's `npm install`).
  - `gemini-extension-spike/SPIKE-NOTES.md` — short README documenting: what this is, how it was generated (by hand), what's known-broken (the hardcoded paths in SKILL.md), and how to install (`gemini extensions link gemini-extension-spike/`).
- Add `gemini-extension-spike/` to `.gitignore`.
- **Verification (the actual goal of this task):**
  1. `gemini extensions link gemini-extension-spike/` succeeds.
  2. Start `gemini` in a test repo. Confirm in order:
     - Extension is listed (`/help` or `gemini extensions list`).
     - SessionStart hook ran: `ls ~/.cache/devostat-spike/dist/` shows the compiled JS files.
     - Skill frontmatter was injected: ask a prompt like *"start a plan for X"* — model should call `activate_skill` for devostat and read SKILL.md.
     - Slash command works: `/devostat` is present in `/help` and, when typed, activates the skill.
  3. Capture any quirks (env-var substitution differences, path quoting issues, skill activation timing) in `SPIKE-NOTES.md`.
- **Deliverable for human review:** the `gemini-extension-spike/` tree + `SPIKE-NOTES.md`. Human inspects the structure, confirms it matches expectations, and gives go-ahead for Tasks 1–7 (or calls out changes needed).
- Test coverage: none — throwaway spike. Document as a deviation in the XML (`type="minor"`, reason: "spike, not production code").

### Task 1 — Host-agnostic `$DEVOSTAT_DIST` in skill + Claude hook **[High]**

*Why High:* Touches the SKILL.md contract that every downstream plan loads. A typo here breaks every future plan on both hosts, not just the new Gemini target.

- Edit `plugin-resources/src/main/resources/hooks/hooks.json`: prepend `export DEVOSTAT_DIST="${CLAUDE_PLUGIN_DATA}/dist" && ` to the existing `diff ||` pipeline. Ensure the exported var is visible to the `echo` at the end so we can grep-verify in session logs.
- Edit `plugin-resources/src/main/resources/skills/devostat/SKILL.md`: replace every hardcoded `/home/pramod/.claude/plugins/data/devostat-bitkentech/dist/` occurrence (roughly 8 script-invocation examples under Phase 1, Phase 2 Step A/B, Low-risk step 4, deviation sections, and closeout sections) with `$DEVOSTAT_DIST/`. Also update the `[Local]` mode description at the top that currently says "compiled…into `/home/pramod/.claude/plugins/data/devostat-bitkentech/dist/`" — change to host-agnostic wording.
- Verification: `mvn process-resources` regenerates `build/skills/devostat/SKILL.md` and `build/hooks/hooks.json`. Launch a fresh Claude Code session in a throwaway repo; confirm (a) hook logs `devostat: deps installed and compiled`, (b) `node $DEVOSTAT_DIST/init.js --help` works, (c) an existing plan's XML tasks can still be read by `show.js`.
- Test coverage: skip — the skill body is documentation, not code. Precedent in plan-18 task 1 for pure-string deviations.

### Task 2 — Parameterise Maven output directory **[High]**

*Why High:* Changes the root pom and two child poms' output-directory references. A mistake risks the `build/` output landing in the wrong place and breaking Claude Code installs for everyone. Reversible, but with a visible blast radius.

- Root `pom.xml`: both `dev` and `prod` profiles already define `<build.outputDir>${project.basedir}/build</build.outputDir>` — keep as-is.
- `plugin-resources/pom.xml`: replace all four `${project.parent.basedir}/build/` occurrences in `<outputDirectory>` with `${build.outputDir}/`.
- `plugin-dist/pom.xml`: replace the two `${project.parent.basedir}/build/` occurrences likewise.
- `plugin-node/pom.xml`: no output-dir changes (it writes to its own module's `dist/`, consumed downstream).
- Verification: `mvn process-resources` with default (`dev`) profile produces an identical `build/` tree byte-for-byte (compare with `diff -r` against a pre-change copy). Claude Code still installs and runs without regression.
- Test: pre/post diff of `build/` is the acceptance test. No new unit tests.

### Task 3 — New Gemini manifest + commands source tree **[Low]**

*Why Low:* Pure additive files with fixed schemas documented by Google. No interaction with existing code paths.

- New source dir: `plugin-resources/src/main/resources/gemini-extension/`
  - `gemini-extension.json` — fields: `name: "${plugin.name}"`, `version: "${project.version}"`, `description: "${plugin.description}"`. No `contextFileName` (on-demand activation). No `mcpServers` (user-level, documented).
  - `commands/devostat.toml` — description + prompt that tells the model to load the devostat skill and apply it to the current task. Rough body:

    ```toml
    description = "Apply the devostat agent coding workflow."
    prompt = "Activate the devostat skill and apply it to the user's current task."
    ```

- Verification: `jq .` on the filtered `build-gemini/gemini-extension.json`; TOML validator on `build-gemini/commands/devostat.toml`.

### Task 4 — New Gemini hook **[High]**

*Why High:* Single most host-specific file. The cache-dir derivation, the `mkdir -p`, and the `${extensionPath}` substitution must all be right on first run or users will hit npm errors inside a read-only dir.

- New file: `plugin-resources/src/main/resources/gemini-extension/hooks/hooks.json`. Same shape as the Claude version but:
  - Replace `${CLAUDE_PLUGIN_ROOT}` → `${extensionPath}` (Gemini substitutes this before exec).
  - Replace `${CLAUDE_PLUGIN_DATA}` → `${HOME}/.cache/devostat` (and `mkdir -p` it first).
  - Export `DEVOSTAT_DIST="${HOME}/.cache/devostat/dist"` so the skill body's script-invocation examples resolve identically to Claude.
- Verification: `gemini extensions link build-gemini/` then start `gemini` in a test repo; confirm hook fires, `~/.cache/devostat/dist/init.js` exists, and `node $DEVOSTAT_DIST/init.js` works inside the session.
- Test: TDD-able via a shell script that invokes the hook command directly with a fake `${extensionPath}` and asserts the expected files exist. Write the assertion script first.

### Task 5 — Gemini Maven profile + aggregator wiring **[High]**

*Why High:* Maven multi-module plumbing is where subtle ordering bugs hide. The Gemini profile must redirect `${build.outputDir}` to `build-gemini/` *and* point the resource copies at the new `gemini-extension/` source tree instead of `claude-plugin/`.

- Root `pom.xml`: add a third profile `gemini` with `<build.outputDir>${project.basedir}/build-gemini</build.outputDir>` and Gemini-flavoured `plugin.name` / `plugin.description` properties if they diverge.
- `plugin-resources/pom.xml`: parameterise the source dir (`${plugin.meta.sourceDir}` or similar) for the `copy-plugin-meta` execution, defaulted to `claude-plugin`; the `gemini` profile overrides it to `gemini-extension`. Analogous moves for hooks (`hooks` vs `gemini-extension/hooks`) and a new `copy-commands` execution that only runs when the Gemini source dir exists.
- `plugin-dist/pom.xml`: the `copy-scripts` + `copy-ts-source` executions already write to `${build.outputDir}/scripts/tasks` once task 2 is done — same scripts ship to both trees unchanged.
- Add `build-gemini/` to `.gitignore`.
- Verification: `mvn -P gemini process-resources` produces `build-gemini/` with the full expected layout. `mvn process-resources` (default `dev`) still produces `build/` identical to before. Run both in sequence and compare with `diff -r`.

### Task 6 — Gemini smoke-test script **[Low]**

*Why Low:* Additive verification harness; no production-path code.

- New script `scripts/smoke-gemini.sh` (or Makefile target) that:
  1. Runs `mvn -P gemini package`.
  2. Creates a tmp test repo with a minimal `.agents/plans/` skeleton.
  3. Runs `gemini extensions link build-gemini/`.
  4. Starts `gemini` non-interactively (if the CLI supports it) and asserts the SessionStart hook output appears.
- Verification: the script exits 0 on a clean machine with `gemini` installed; documents the install steps if it isn't.

### Task 7 — Docs: install-on-Gemini section **[Low]**

*Why Low:* Documentation only.

- `README.md`: new "Install on Gemini CLI" subsection under the existing "Installation". Include `gemini extensions install https://github.com/bitkentech/devostat` and the Linear MCP settings.json snippet.
- `DEVELOPMENT.md`: mirror the Claude development flow for Gemini (`mvn -P gemini package`, `gemini extensions link`, uninstall command).
- Verification: read-through coherence check.

---

## Critical files to read before execution

- `plugin-resources/src/main/resources/skills/devostat/SKILL.md` — every `$DEVOSTAT_DIST` replacement point is here.
- `plugin-resources/src/main/resources/hooks/hooks.json` — canonical shape of the Claude hook.
- `plugin-resources/pom.xml` — the resource-filtering template to generalise for Gemini.
- `plugin-dist/pom.xml` — shows how compiled scripts land in `build/`; unchanged after task 2.
- `pom.xml` (root) — profile declarations go here.
- `.agents/plans/plan-18.md` + `plan-18-tasks.xml` — closest precedent for a low-risk, mostly-config, single-branch plan.

---

## Verification (end-to-end)

1. `mvn -P gemini package && mvn package` — both builds succeed. `diff -rq build/ build-gemini/` shows only the expected differences (manifest name, `commands/` dir, hook env-var substitutions).
2. **Claude Code regression:** `claude` in a throwaway repo — devostat loads, SessionStart hook runs, `node $DEVOSTAT_DIST/init.js` works, an existing plan's XML can be read via `show.js`. Must be identical to pre-plan behaviour.
3. **Gemini happy path:** `gemini extensions link build-gemini/` + `gemini` in the same throwaway repo — hook runs, skill auto-activates on a prompt like "start a plan for adding a feature", `/devostat` slash command appears in `/help`, the devostat scripts run via `$DEVOSTAT_DIST`.
4. **Cross-host handoff (the actual user goal):** Start Phase 1 of a dummy plan in Claude Code, commit the plan file + XML, then open Gemini CLI on the same repo and ask it to resume — it reads `.agents/plans/plan-{N}.md` + `plan-{N}-tasks.xml` and picks up at the next task.
