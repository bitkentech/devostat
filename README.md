# code-flow
Claude plugin for an agentic coding workflow.  

## Main features of the workflow:
- Generate a plan file before implementation
- Plan files are tracked in version control, and can be modified safely whenever the implementation approach changes
- The tasks created from a plan (and its modifications) are pushed to an issue tracker for easy monitoring
- You can pause the work any time and resume easily, thanks to the extensive tracking

### Other features:
- Plans default to breaking down the feature into vertical slices
- Test Driven Development along with Integration tests

## Installation

**From within Claude Code:**

First, register the marketplace (one-time setup):
```
/plugin marketplace add https://github.com/pramodbiligiri/claude-plugins
```

Then install the plugin:
```
/plugin install code-flow@pramodb-plugins
```

---

A Claude skill for a development workflow that's built on the following assumptions:
- You build software in vertical slices as much as possible.
- You create a plan (roughly corresponds to a feature or some logical unit of work) for the code changes and then start implementing it. But you're open to modifying the plan midway based on how it's going.
- You might get blocked or have to pause the work (for any number of reasons) and resume it later.
- For every plan, all its versions are permanently checked into the source control system
- Testing is integrated as a fundamental part of the workflow — each task requires a failing test before implementation, and coverage is verified before committing
- TODO: Enable the dev to choose the sequence of tasks (maybe they'll develop the riskier or more unknown parts of the feature first)
- Each task is committed after tests pass and coverage is verified, creating a rollback point per task
- TODO: Rename plan to spec, all across the skill?
