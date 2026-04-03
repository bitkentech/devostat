A Claude skill for a development workflow that's built on the following assumptions:
- You build software in vertical slices as much as possible.
- You create a plan (roughly corresponds to a feature or some logical unit of work) for the code changes and then start implementing it. But you're open to modifying the plan midway based on how it's going.
- You might get blocked or have to pause the work (for any number of reasons) and resume it later.
- For every plan, all its versions are permanently checked into the source control system
- TODO: Integrate testing as a fundamental part of the workflow
- TODO: Enable the dev to choose the sequence of tasks (maybe they'll develop the riskier or more unknown parts of the feature first)
- Each task is committed after tests pass and coverage is verified, creating a rollback point per task
- TODO: Rename plan to spec, all across the skill?
