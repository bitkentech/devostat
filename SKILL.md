# code-flow — Agent Coding Workflow

## When to apply this skill
Apply this skill whenever you are:
- Starting work on a new feature or task
- Asked to write, revise, or execute a plan
- Picking up existing work from Linear
- Closing out, abandoning, or handing off a plan

---

## Core Invariants — Never Violate These

1. **Features vs Plans are strictly separate.** Feature issues live in the permanent backlog forever. Plan issues live in transient `[agent]` projects and are archived after completion. Never create feature issues inside an `[agent]` project.
2. **A committed, pushed, human-reviewed plan is the contract.** You execute against it. You do not autonomously modify it.
3. **Every `[agent]` project must reference at least one permanent backlog feature issue.** If none exists, stop and create one before proceeding.
4. **Linear is never the source of truth for plan content.** Git is. Linear tracks task state only.
5. **Tags are permanent.** Never delete a plan version tag from remote, even on abandonment or squash merge.

---

## Repository Structure

```
.agents/
  plans/
    plan-07.md       # plan files live here, versioned in git
```

Plans are markdown files. They contain: narrative, design decisions, architecture notes, open questions, and references. Code never goes here.

---

## Git Tagging Convention

Every time a plan file is committed and pushed, immediately create and push a version tag:

```bash
# After committing a plan file change:
git tag plan-07-v1
git push origin plan-07-v1

# Subsequent revisions:
git tag plan-07-v2
git push origin plan-07-v2

# On clean completion:
git tag plan-07-complete
git push origin plan-07-complete

# On abandonment (tag the deletion commit too):
git tag plan-07-abandoned
git push origin plan-07-abandoned
```

Tag naming: `plan-{N}-v{version}` for iterations, `plan-{N}-complete` for clean closeout, `plan-{N}-abandoned` for abandonment.

### Automate with lefthook

Commit a hook so tagging fires automatically on every push, regardless of whether a human or agent made the commit:

```yaml
# lefthook.yml
pre-push:
  commands:
    auto-tag-plans:
      run: |
        # Detect if any .agents/plans/ file changed in the push
        if git diff --name-only HEAD~1 HEAD | grep -q '^\.agents/plans/'; then
          PLAN=$(git diff --name-only HEAD~1 HEAD | grep '^\.agents/plans/' | head -1)
          PLAN_ID=$(echo "$PLAN" | grep -oP 'plan-\d+')
          # Find next version number
          LATEST=$(git tag -l "${PLAN_ID}-v*" | sort -V | tail -1)
          if [ -z "$LATEST" ]; then
            NEXT="${PLAN_ID}-v1"
          else
            N=$(echo "$LATEST" | grep -oP '\d+$')
            NEXT="${PLAN_ID}-v$((N+1))"
          fi
          git tag "$NEXT"
          git push origin "$NEXT"
          echo "Auto-tagged: $NEXT"
        fi
```

Install lefthook if not present: `npm install -g lefthook && lefthook install`

---

## Linear Structure

### Permanent Backlog Project
- Named e.g. `AppName — Backlog & Roadmap`
- Contains feature issues only
- Human-created and human-prioritised
- Never deleted, survives all plan lifecycles

### Transient Agent Projects
- Named: `[agent] {N} · {short-description}` e.g. `[agent] 07 · home-accounts-settings-bottom-tabs`
- Created per plan, archived after completion
- Project description must contain:
  - Link to the permanent backlog feature issue(s) it delivers
  - Permalink to the plan file using the tag-based commit hash URL (see below)
  - Brief plan narrative / design rationale

### Tag-based GitHub permalink format
```
https://github.com/{org}/{repo}/blob/{tag-commit-hash}/.agents/plans/plan-07.md
```

Resolve the commit hash for a tag:
```bash
git rev-list -n 1 plan-07-v1
```

Use this hash (not the tag name) in Linear links — it is immutable and survives branch deletion, rebases, and squash merges.

---

## Phase 1 — Plan & Commit (No Code Yet)

**You do not write or run any code during this phase.**

1. Write or update the plan file at `.agents/plans/plan-{N}.md`
2. Commit the plan file:
   ```bash
   git add .agents/plans/plan-07.md
   git commit -m "plan(07): initial plan for home accounts settings bottom tabs"
   git push origin {branch}
   # Hook auto-tags plan-07-v1 and pushes it
   ```
3. Verify all preconditions before touching Linear:
   ```bash
   git status                          # must be clean
   git log origin/{branch}..HEAD       # must be empty (all pushed)
   git tag -l "plan-07-v1"             # must exist
   git ls-remote origin "plan-07-v1"   # must be on remote
   ```
4. Create the `[agent]` Linear project with:
   - Plan narrative in description
   - Link to permanent backlog feature issue(s)
   - Tag-based permalink to the plan file
5. Create Linear issues from plan tasks. Each issue description must include:
   - The tag-based GitHub URL that generated it (so it's traceable to the exact plan version)
6. **Stop. Post to the Linear project that the plan is ready for review.**
7. **Wait for explicit human go-ahead before proceeding to Phase 2.**

---

## Phase 2 — Execute

Work against Linear issues sequentially.

- Every PR and commit references the Linear issue being addressed (e.g. `fixes TF-42`)
- **Minor deviation** (task split, reorder, clarification): Update the Linear issue(s) only, add a deviation comment explaining why, continue.
- **Major deviation** (fundamental plan problem, architecture issue, blocked): Stop immediately. Post a Linear project update. Set project health to **"At Risk"**. Wait for the human to revise the plan file, commit, push, and give a new go-ahead.

Never autonomously modify the `.agents/plans/` file during execution. If a plan change is needed, surface it and wait.

---

## Plan Closeout

### Clean Completion
```bash
git tag plan-07-complete
git push origin plan-07-complete
```
- Close all Linear issues in the `[agent]` project
- Mark `[agent]` project complete and archive it
- Update the permanent backlog feature issue to reflect delivery (link to completing PR, note what was delivered)

### Completion with Loose Ends
- Label unresolved issues `needs-triage` in Linear
- Set `[agent]` project to **"In Review"** (not completed)
- Post a Linear project update listing each open issue and why it's unresolved
- Wait for human to review: they will promote worthy issues to the permanent backlog or discard them
- Human marks the `[agent]` project complete and archives it

### Abandonment
- Human commits a plan file deletion with a commit message referencing the superseding plan number
- You tag the deletion commit:
  ```bash
  git tag plan-07-abandoned
  git push origin plan-07-abandoned
  ```
- **Do not delete any earlier tags** (`plan-07-v1`, `plan-07-v2`, etc.) — they are the audit trail
- Surface all open Linear tasks for human triage
- Migrate worthy tasks to the permanent backlog with a note: "Partial delivery — see plan-07-abandoned, superseded by plan-{M}"
- Archive the `[agent]` project with a closing note referencing the deletion commit hash and the superseding plan

---

## Audit Trail — What to Record in Every Linear Issue

| Event | What to store in the issue |
|---|---|
| Task created | `github.com/.../blob/{plan-07-v1-hash}/.agents/plans/plan-07.md` |
| Task closed / obsoleted | `github.com/.../blob/{plan-07-vN-hash}/.agents/plans/plan-07.md` + one-line reason |

If the creation hash equals the closeout hash, the plan never changed during execution. If they differ, the GitHub diff between the two URLs shows exactly what changed and why.

Feature issues in the permanent backlog should accumulate references to every plan that contributed to them — this gives a full delivery history across the feature's lifetime.

---

## What Lives Where — Quick Reference

| Content | Location | Reason |
|---|---|---|
| Plan narrative, design decisions, references | `.agents/plans/*.md` in git | Needs diffs, version history, co-evolution with code |
| Task state (done / not done) | Linear `[agent]` project | Needs status tracking and human review |
| Feature definitions | Linear permanent backlog | Permanent, human-curated |
| Link between plan version and tasks | Tag-based GitHub permalink in Linear issue description | Immutable, survives branch lifecycle |
| This workflow | `~/.claude/skills/code-flow/SKILL.md` | Loaded by agent at task start |
| Repo-specific overrides | `CLAUDE.md` in repo root | Workspace name, Linear project conventions, etc. |

---
