# Plan 20 — Gemini Extension Release Process

## Context

`scripts/release.sh` builds and publishes the Claude Code plugin to the orphan `releases` branch and creates a GitHub Release. The Gemini CLI extension (added in plan-19) has no release process — `build-gemini/` is gitignored and never published.

Gemini CLI installs extensions by cloning a repo where `gemini-extension.json` lives at the root. Rather than polluting this source repo with build artifacts or orphan-branch gymnastics, a dedicated `bitkentech/devostat-gemini` repo is used as a pure publish artifact — analogous to the `releases` orphan branch for Claude, but cleaner.

**Permanent backlog feature issue:** [PB-270 — *Create release builds and process for Gemini Extension*](https://linear.app/pb-default/issue/PB-270/create-release-builds-and-process-for-gemini-extension)

### End-user install command (post-plan)

```
gemini extensions install https://github.com/bitkentech/devostat-gemini
```

No `--ref` needed. Gemini auto-prompts users to update when new commits land on `main` of that repo.

### devostat-gemini repo layout

The repo contains only the Maven gemini build output (`build-gemini/*`). Never hand-edited:

```
devostat-gemini/
  gemini-extension.json
  hooks/hooks.json
  commands/devostat.toml
  skills/devostat/SKILL.md
  dist/          (9 compiled JS files)
  package.json
```

### Build model

`mvn process-resources -P 'gemini,!dev,!claude'` already produces this tree in `build-gemini/`. The release script stamps the version via `jq` post-build (same pattern as Claude's `plugin.json` stamping).

### Resolved decisions

- **Dedicated repo** (`bitkentech/devostat-gemini`): clean install URL, no branch gymnastics in source repo.
- **Same version tag** (`v0.2.0`) in both repos: users see consistent versioning.
- **Atomic release**: single `./scripts/release.sh 0.2.0` publishes both Claude and Gemini.
- **Both builds up-front**: if either Maven build fails, nothing is published.
- **One-time setup**: create `devostat-gemini` as a public empty GitHub repo. Documented in script header.
- **Task tracking:** `[Local]` XML at `.agents/plans/plan-20-tasks.xml`.
- **Coverage threshold:** N/A — this plan is a single shell script edit with no TDD surface. Same precedent as plan-18 task 1 and plan-19 tasks 1–3.

---

## Tasks (risk-sorted)

### Task 1 — Extend release.sh with Gemini section [Risk: Low]

Modify `scripts/release.sh` to:

1. Add `GEMINI_TAG`, `GEMINI_REPO`, `GEMINI_REPO_URL`, `GEMINI_CLONE_DIR` variables after `TAG=` line.
2. Add preflight check: `gh release view "$GEMINI_TAG" --repo "$GEMINI_REPO"` must not exist.
3. After Claude `jq` stamp: clean `build-gemini/`, run `mvn process-resources -P 'gemini,!dev,!claude' -q`, stamp version into `build-gemini/gemini-extension.json` via `jq`.
4. After existing `gh release create` + `git checkout "$ORIGINAL_BRANCH"`: clone `devostat-gemini`, replace contents with `build-gemini/*`, commit, tag, push.
5. Create GitHub Release in `devostat-gemini` repo via `gh release create --repo`.
6. Clean up temp clone dir.
7. Update final echo to report both releases.

**Acceptance:** `./scripts/release.sh 0.2.0` (against a real or dry-run) produces correct output in both repos. Verified via the checks in the Verification section below.

---

## Verification

1. One-time: create `bitkentech/devostat-gemini` as a public empty repo on GitHub.
2. From clean `main`: `./scripts/release.sh <version>`
3. Confirm:
   - `git show releases:dist/.claude-plugin/plugin.json | jq .version` → correct version
   - `gh api repos/bitkentech/devostat-gemini/contents/gemini-extension.json | jq -r .content | base64 -d | jq .version` → correct version
   - Two GitHub Releases exist: `v<version>` in `bitkentech/devostat` and `bitkentech/devostat-gemini`
4. Install test: `gemini extensions install https://github.com/bitkentech/devostat-gemini` — no `--ref` needed.
