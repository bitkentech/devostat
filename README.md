# code-flow
Claude plugin for an agentic coding workflow.  

## Features (aspirations?) of the workflow
- Coding tasks are planned and tracked via plan files checked into version control and an external issue tracker (currently only Linear).
- The user interactively categorizes planned out tasks as Low/Medium/High risk. This informs the order of task implementation. The agent (ideally) notifies the user and pauses for feedback if it starts seeing things go wrong.
- Tasks correspond to useful bits of functionality (vertical slices) and not technical layers. Higher risk tasks are picked up first in order to be able to fail fast. Code quality and test coverage are increased only after the basic functionality of the tasks is known to work.
- You are free to stop and change the implementation approach after kick off. Since plan files are tracked in version control, the latest version gets picked up. Tasks from older versions should get removed from the issue tracker etc. **TODO**: Check if corresponding code gets deleted.
- You can pause your session any time and resume from where you left off, thanks to extensive tracking and checkpoints.

## Installation

**From within Claude Code:**

First, register the marketplace (one-time setup):
```
/plugin marketplace add pramodbiligiri/claude-plugins
```

Then install the plugin:
```
/plugin install code-flow@pramodb-plugins
```

---

## Principles behind this workflow

The workflow borrows ideas from the [Spiral Model](https://en.wikipedia.org/wiki/Spiral_model) and general [Agile](https://en.wikipedia.org/wiki/Agile_software_development) principles. You first try to de-risk the implementation by picking up the risky/unknown parts (which is sometimes the end-user experience, and sometimes technical complexity), and validating the approach. Once the implementation looks feasible, pick up the easy, low risk tasks and focus on aspects like quality of code, test coverage etc.

## Development

### Prerequisites
- Java 21
- Maven

### Build the dev version

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

### Register the dev build with Claude Code

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

### Usage

Start Claude in any project. The `/code-flow-dev` slash command invokes the dev build.

### Switching back to production

Toggle `enabledPlugins` in `~/.claude/settings.json`:

```json
"enabledPlugins": {
  "code-flow@pramodb-plugins": true,
  "code-flow-dev@code-flow-dev": false
}
```

### Notes
- Restart Claude after each `mvn process-resources` run to pick up changes
- `build/` is gitignored — it is always a local, derived artifact
