# Plan 16 — GitHub Release Build Process for devostat

**Status:** PAUSED — awaiting clarification on artifact format
**Linear issue:** PB-255 (child of PB-123)
**Branch:** t/pb-255-github-release-build

---

## Context

The `devostat` plugin has no CI/CD release pipeline. The production build requires
running `mvn process-resources -Pprod` locally to compile TypeScript and assemble
the `build/` directory. That output is gitignored and never committed.

The README advertises installation via:
```
/plugin marketplace add pramodbiligiri/claude-plugins
/plugin install devostat@pramodb-plugins
```

But the `pramodbiligiri/claude-plugins` marketplace repo needs to point to a GitHub
repo+SHA where the **compiled plugin files** actually exist:
- `.claude-plugin/plugin.json`
- `skills/devostat/SKILL.md`
- `hooks/hooks.json`
- `scripts/tasks/*.js` + `*.ts`
- `package.json`

Currently none of these are at any published SHA.

---

## Blocking Question (must resolve before planning)

**What artifact/structure does the Claude Code plugin system expect at install time?**

### Option A — `dist` branch
CI builds on tag/push, commits `build/` contents to a dedicated `dist` branch.
Marketplace entry points to a SHA on that branch.
- Pro: main branch stays clean
- Con: two branches to manage

### Option B — Committed `dist/` folder in main
Built artifacts committed to a tracked `dist/` folder on main.
CI rebuilds and commits this folder on each release.
- Pro: one branch, simple SHA reference
- Con: compiled files in main alongside source

### Option C — GitHub Release ZIP
CI attaches a ZIP of `build/` to a GitHub Release.
- Pro: clean source/artifact separation
- Con: uncertain if Claude Code plugin system supports this format

**Session was paused while the user was considering this question.**

---

## Prep work completed (2026-04-10)

- Full project structure explored (Maven multi-module: plugin-node, plugin-resources, plugin-dist)
- Build command confirmed: `mvn process-resources` (dev) / `mvn process-resources -Pprod` (prod)
- No `.github/workflows/` exists yet
- `build/` is gitignored
- `marketplace.json` lives in `plugin-resources/src/main/resources/claude-plugin/marketplace.json`
- Root `.claude-plugin/plugin.json` is the static (non-templated) manifest

---

## Next steps on resume

1. Answer the blocking question (artifact format)
2. Design the GitHub Actions workflow
3. Determine if `pramodbiligiri/claude-plugins` marketplace repo needs to be created/updated
4. Complete Phase 1 (risk analysis, calibration, commit & tag)
5. Create Linear `[agent]` project and issues
