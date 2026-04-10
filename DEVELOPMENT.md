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

This produces a `build/` directory containing the `code-flow-dev` plugin and skill:
```
build/
  skills/code-flow-dev/SKILL.md
  .claude-plugin/marketplace.json
  .claude-plugin/plugin.json
```

## Register the dev build with Claude Code

Add to `~/.claude/settings.json`:

```json
"extraKnownMarketplaces": {
  "code-flow-dev": {
    "source": {
      "source": "directory",
      "path": "/path/to/code-flow/build"
    }
  }
},
"enabledPlugins": {
  "code-flow@pramodb-plugins": false,
  "code-flow-dev@code-flow-dev": true
}
```

Replace `/path/to/code-flow` with the absolute path to this repo.

## Usage

Start Claude in any project. The `/code-flow-dev` slash command invokes the dev build.

## Switching back to production

Toggle `enabledPlugins` in `~/.claude/settings.json`:

```json
"enabledPlugins": {
  "code-flow@pramodb-plugins": true,
  "code-flow-dev@code-flow-dev": false
}
```

## Notes
- Restart Claude after each `mvn process-resources` run to pick up changes
- `build/` is gitignored — it is always a local, derived artifact
