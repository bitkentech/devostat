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

## Releasing a new version

Releases are published to the orphan `releases` branch and tagged as GitHub Releases. Users receive updates on their next `/plugin marketplace update`.

### Prerequisites

- `jq` installed
- `gh` (GitHub CLI) installed and authenticated
- Working tree must be clean (no uncommitted changes)

### Steps

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

### Structure of the `releases` branch

```
dist/
├── .claude-plugin/plugin.json   (version-stamped)
├── hooks/
├── scripts/
├── skills/devostat/
└── package.json
```

The `releases` branch is an orphan — it shares no history with `main`.
