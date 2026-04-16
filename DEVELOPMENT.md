# Development

## Prerequisites
- Java 21
- Maven
- Node.js 18+

## Repo structure

This repo uses a multi-module Maven layout:
- `plugin-node/` — TypeScript source and tests for the local task tracking scripts
- `plugin-resources/` — SKILL.md, plugin metadata, and hooks
- `plugin-dist/` — assembles the final `build/` output from the other two modules

## Build the dev version

```bash
mvn process-resources
```

This produces a `build/` directory containing the `devostat-dev` plugin and skill:
```
build/
  skills/devostat-dev/SKILL.md
  .claude-plugin/marketplace.json
  .claude-plugin/plugin.json
```

## Register the dev build with Claude Code

Add to `~/.claude/settings.json`:

```json
"extraKnownMarketplaces": {
  "devostat-dev": {
    "source": {
      "source": "directory",
      "path": "/path/to/devostat/build"
    }
  }
},
"enabledPlugins": {
  "devostat@bitkentech": false,
  "devostat-dev@devostat-dev": true
}
```

Replace `/path/to/devostat` with the absolute path to this repo.

## Usage

Start Claude in any project. The `/devostat-dev` slash command invokes the dev build.

## Switching back to production

Toggle `enabledPlugins` in `~/.claude/settings.json`:

```json
"enabledPlugins": {
  "devostat@bitkentech": true,
  "devostat-dev@devostat-dev": false
}
```

## Notes
- Restart Claude after each `mvn process-resources` run to pick up changes
- `build/` is gitignored — it is always a local, derived artifact

## Gemini CLI development

### Prerequisites
- Gemini CLI installed (`npm install -g @google/gemini-cli`)

### Build the Gemini extension

```bash
mvn -P gemini,!dev,!claude process-resources
```

This produces `build-gemini/` containing the Gemini extension:
```
build-gemini/
  gemini-extension.json
  skills/devostat/SKILL.md   (with YAML frontmatter, ~/.cache/devostat/dist paths)
  hooks/hooks.json           (uses ${extensionPath} and ${HOME})
  commands/devostat.toml
  dist/                      (pre-compiled JS — copied to ~/.cache/devostat/dist/ by hook)
  package.json
```

### Link for local development

```bash
gemini extensions link --consent build-gemini/
```

Changes to source files are reflected immediately after the next `mvn process-resources` run — no re-link needed (Gemini reads from the source path at load time).

### Run smoke tests

```bash
./scripts/smoke-gemini.sh
```

Verifies the build layout, links the extension, and runs the hook logic test.

### Uninstall

```bash
gemini extensions uninstall devostat
```

### Notes
- `build-gemini/` is gitignored — always a local, derived artifact
- Run `mvn process-resources` (default, no `-P gemini`) to rebuild the Claude plugin; run `mvn -P gemini,!dev,!claude process-resources` for Gemini
- The `claude` profile in `plugin-resources/pom.xml` is `activeByDefault` — always disable it explicitly when building for Gemini

## Releasing a new version

### Prerequisites

- `jq` installed
- `gh` (GitHub CLI) installed and authenticated
- Working tree must be clean (no uncommitted changes)

### Claude Code release

Releases are published to the orphan `releases` branch and tagged as GitHub Releases. Users receive updates on their next `/plugin marketplace update`.

```bash
./scripts/release.sh <version>
# Example:
./scripts/release.sh 0.2.0
```

The script:
1. Cleans `build/` and runs `mvn process-resources -Pprod -P!dev`
2. Stamps the version into `build/.claude-plugin/plugin.json`
3. Checks out the orphan `releases` branch
4. Replaces `dist/` with the new build output
5. Commits, tags `v<version>`, and pushes both branch and tag
6. Creates a GitHub Release via `gh release create`
7. Returns to the original branch

Structure of the `releases` branch:
```
dist/
├── .claude-plugin/plugin.json   (version-stamped)
├── hooks/
├── scripts/
├── skills/devostat/
└── package.json
```

The `releases` branch is an orphan — it shares no history with `main`.

### Gemini CLI release

Gemini CLI installs extensions by cloning a repo where `gemini-extension.json` lives at the root (see [Gemini CLI extension releasing docs](https://geminicli.com/docs/extensions/releasing/)). This is incompatible with the layout of the `releases` branch, where Claude's `.claude-plugin/` metadata sits at the root of `dist/`. Rather than add branch-switching complexity here, Gemini releases are published to a dedicated repo — [`bitkentech/devostat-gemini`](https://github.com/bitkentech/devostat-gemini) — whose `main` branch is a pure publish artifact fully replaced on each release.

```bash
./scripts/release-gemini.sh <version>
# Example:
./scripts/release-gemini.sh 0.0.1
```

The script:
1. Cleans `build-gemini/` and runs `mvn process-resources -P 'gemini,!dev,!claude'`
2. Stamps the version into `build-gemini/gemini-extension.json`
3. Clones `devostat-gemini` into a temp directory
4. Replaces its contents with the new build output
5. Commits, tags `v<version>`, and pushes both branch and tag
6. Creates a GitHub Release in `devostat-gemini` via `gh release create`
7. Cleans up the temp clone

Pass `--force` to skip the clean-tree check (useful during iterative testing):
```bash
./scripts/release-gemini.sh 0.0.2 --force
```

Structure of the `devostat-gemini` repo after release:
```
├── gemini-extension.json   (version-stamped)
├── commands/devostat.toml
├── hooks/hooks.json
├── skills/devostat/SKILL.md
├── dist/                   (pre-compiled JS)
└── package.json
```
