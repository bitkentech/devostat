# Plan 25 — plugin-site: JBake static site scaffold

## Context

devostat needs a product website hosted on a VPS. The goal is to establish the end-to-end JBake pipeline as a new `plugin-site` Maven module with Groovy templating, before any real page content is designed. This plan gets the skeleton building and deployable. Page content comes in a later plan.

**Permanent backlog feature issue:** Tracked in plan file (Linear free tier limit reached — Local mode)
**Task tracking:** `[Local]` XML at `.agents/plans/plan-25-tasks.xml`

---

## Approach

Add a `plugin-site` Maven submodule using `jbake-maven-plugin` (v0.3.2). The module uses JBake's standard directory layout with Groovy (`.groovy`) templates. `mvn generate-resources -pl plugin-site` produces a static `output/` directory ready to rsync to the VPS. No JVM at runtime — output is pure static HTML/CSS/JS.

Reference: https://jbake.org/docs/2.6.6/#quickstart_guide

---

## Tasks (risk-sorted)

### Task 1: Create `plugin-site` Maven module with JBake plugin [High]

**Risk reason:** First time wiring JBake into this Maven project — plugin coordinates, dependency versions, and directory layout need validation against actual build output.

- Create `plugin-site/pom.xml` inheriting from the parent POM (`packaging=pom`)
- Configure `jbake-maven-plugin` v0.3.2, bound to `generate-resources` phase, goal `generate`
- Add dependencies for Groovy templating (`org.apache.groovy:groovy-templates:4.0.21`) and Markdown (`com.vladsch.flexmark:flexmark-all:0.62.2`)
- Add `plugin-site` to parent `pom.xml` `<modules>` list

### Task 2: Add JBake directory scaffold and minimal content [Medium]

**Risk reason:** Groovy template syntax and `jbake.properties` config must be correct for the build to succeed — easy to get wrong on first try.

Create standard JBake layout under `plugin-site/src/main/jbake/`:

```
plugin-site/src/main/jbake/
  jbake.properties
  content/
    index.html
  templates/
    index.groovy
  assets/
    css/
      style.css
```

`content/index.html` front matter:
```
title=devostat
type=index
status=published
~~~~~~
<p>devostat — agentic coding workflow for Claude Code.</p>
```

### Task 3: Verify build and add deploy script [Low]

**Risk reason:** rsync one-liner, low risk — just confirming correct output path.

- Run `mvn generate-resources -pl plugin-site`, confirm output contains `index.html`
- Add `scripts/deploy-site.sh` — rsync output dir to VPS (host/user as placeholders)

---

## Verification

```bash
cd /opt/workspace/devostat
mvn generate-resources -pl plugin-site
find plugin-site -name "index.html"
cat <path-to-output>/index.html
# Expected: contains "devostat", no build errors
```
