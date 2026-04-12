# Plan 17 — Demo GIF for README (PB-261)

**Status:** DRAFT
**Linear backlog issue:** [PB-261](https://linear.app/pb-default/issue/PB-261/media-addition-for-docs-demo-gif-for-readme) (code-flow Skill project)
**Branch:** `t/pb-261-readme-demo-gif`
**Task tracking:** Local

---

## Context

The devostat README has no visual demo. A user landing on the GitHub page has no quick way to understand what a devostat session looks like. A first-pass animated GIF (`docs/demo-small.gif`) is already rendered and embedded in `README.md`, but the source `docs/demo.cast` has weaknesses:

- Recording starts with the `$ claude` invocation and startup animation (wastes the first ~1s)
- The skill load command shown is `/devostat` instead of the correct `/devostat:devostat`
- Recording ends before the first task in the demo plan completes, so the "closure" of the workflow isn't visible

This plan applies a small set of minor edits to the existing cast, re-renders the GIF, and merges to `main` as a cosmetic improvement. Deeper content improvements (showing plan-changing, richer session content) are deferred — the same branch will stay alive for follow-up work before a second merge.

**TDD note:** The work is content editing (a recorded terminal session + rendered GIF), not code. Core Invariant #6 (tests precede implementation) doesn't apply here — verification is visual inspection of the rendered GIF and README preview. This is recorded here as a minor deviation to the standard workflow.

---

## Tasks

### Task 1 — Edit demo.cast (Medium risk)

Apply three content fixes directly to the JSON-per-line `docs/demo.cast` file:

1. **Trim the opening.** Remove events showing the `$ claude` invocation and Claude Code startup animation. Cast should begin with Claude Code already loaded and ready at the prompt. Re-base timestamps so the first remaining event is at `0.0`.
2. **Fix the skill-load command.** Where the cast shows `/devostat` being entered, change it to `/devostat:devostat` and update the corresponding echo/acknowledgement output.
3. **Extend end point (conditional).** If the current cast ends before the first task in the demo plan completes, extend the recording up to task completion. Only keep this extension if the re-rendered GIF stays under ~2MB; otherwise trim back to ~30s.

Medium risk because hand-editing a `.cast` file (preserving event structure, timestamps, ANSI escape sequences) has a moderate chance of breaking playback. Must verify by rendering.

### Task 2 — Re-render demo-small.gif (Low risk)

Run the proven render pipeline:

```bash
agg --theme github-light --fps-cap 10 --idle-time-limit 2 \
    --font-size 16 --rows 15 \
    docs/demo.cast docs/demo-small.gif
```

Verify:
- File opens and plays correctly
- Text legible at 1:1 zoom in browser
- File size <2MB (ideally ~1-1.5MB)

If size exceeds 2MB with the extended end point, fall back: re-trim the cast to ~30s, re-render.

### Task 3 — Commit and land on main (Low risk)

Commit only the three relevant files to `t/pb-261-readme-demo-gif`:
- `README.md` (GIF embed already staged)
- `docs/demo.cast` (edited source)
- `docs/demo-small.gif` (rendered output)

Do **not** commit scratch artifacts: `docs/demo-30s.cast`, `docs/demo-30s.gif`, `docs/demo-640.gif`.

Push, then merge to `main` (fast-forward or squash — user chooses at merge time). Keep the branch alive for deeper content overhaul work in a future pass.

---

## Risk-sorted order

1. **Task 1** — Edit demo.cast (Medium)
2. **Task 2** — Re-render GIF (Low)
3. **Task 3** — Commit & merge to main (Low)

No reordering needed — medium-risk task has no low-risk dependency that must come first.

---

## Verification

1. `docs/demo-small.gif` opens in Firefox, loops and plays correctly, text legible at 1:1 zoom
2. `README.md` renders in Typora — GIF appears proportional to surrounding text
3. `ls -lh docs/demo-small.gif` → target <2MB
4. `git diff main..t/pb-261-readme-demo-gif --name-only` shows only `README.md`, `docs/demo.cast`, `docs/demo-small.gif`
5. After merge, `git log main --oneline -3` shows the merge commit
