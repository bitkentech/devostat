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
  "devostat@pramodb-plugins": false,
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
  "devostat@pramodb-plugins": true,
  "devostat-dev@devostat-dev": false
}
```

## Notes
- Restart Claude after each `mvn process-resources` run to pick up changes
- `build/` is gitignored — it is always a local, derived artifact
