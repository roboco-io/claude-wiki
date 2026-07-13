# Upstream Sync Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Exception: Task 3 is interactive (AskUserQuestion with the maintainer) and MUST run in the main session, not a subagent.**

**Goal:** A maintainer-only skill at `.claude/skills/upstream-sync/SKILL.md` that scans langchain-ai/openwiki for claude-wiki-relevant changes, writes an adaptation report, and applies maintainer-approved proposals.

**Architecture:** Pure prompt-markdown skill (no TypeScript — consistent with the project's "intelligence lives in markdown" constraint) plus a committed state file `docs/upstream/state.json` (same idiom as `claude-wiki.json`). The local openwiki clone is a read-only data source.

**Tech Stack:** Claude Code project skill (markdown), git plumbing on an external clone, JSON state file.

## Global Constraints

- The openwiki clone (`~/Workspace/opensource/openwiki`) is READ-ONLY: `git fetch`/`log`/`show`/`rev-parse` only — never checkout, reset, or write in it.
- Never copy upstream TypeScript into claude-wiki source; upstream changes translate into prompt/doc edits (project hard constraint: intelligence lives in markdown).
- This skill is NOT distributed: `package.json` `files` and the plugin layout (`commands/`, `skills/` at repo root) are untouched. The new skill lives under `.claude/skills/`.
- Skill writes are limited to `docs/upstream/` + files named in approved proposals.
- Spec: `docs/superpowers/specs/2026-07-13-upstream-sync-skill-design.md`.

---

### Task 1: State file with resolved baseline

**Files:**
- Create: `docs/upstream/state.json`

**Interfaces:**
- Produces: `docs/upstream/state.json` with fields `upstreamRepo`, `localClonePath`, `lastReviewedCommit`, `lastRunAt` — Task 2's SKILL.md reads exactly these field names; Task 3's run consumes the baseline.

- [ ] **Step 1: Resolve the port-date baseline sha**

```bash
git -C ~/Workspace/opensource/openwiki fetch origin
git -C ~/Workspace/opensource/openwiki rev-list -1 --before=2026-07-12T00:00:00Z origin/main
```

Expected: prints one full sha (the openwiki main commit as of the 2026-07-12 port date). Record it as BASELINE.

- [ ] **Step 2: Write the state file**

Create `docs/upstream/state.json` (replace `<BASELINE>` with the sha from Step 1; keep `lastRunAt` null — the first real run stamps it):

```json
{
  "upstreamRepo": "langchain-ai/openwiki",
  "localClonePath": "~/Workspace/opensource/openwiki",
  "lastReviewedCommit": "<BASELINE>",
  "lastRunAt": null
}
```

- [ ] **Step 3: Validate and commit**

```bash
node -e "const s=require('./docs/upstream/state.json'); if(!/^[0-9a-f]{40}$/.test(s.lastReviewedCommit)) process.exit(1); console.log('state OK')"
git -C ~/Workspace/opensource/openwiki cat-file -e "$(node -p "require('./docs/upstream/state.json').lastReviewedCommit")" && echo "sha exists upstream"
git add docs/upstream/state.json
git commit -m "chore: add upstream-sync state file (baseline = openwiki main at port date)"
```

Expected: `state OK`, `sha exists upstream`, commit succeeds.

---

### Task 2: The skill — `.claude/skills/upstream-sync/SKILL.md`

**Files:**
- Create: `.claude/skills/upstream-sync/SKILL.md`

**Interfaces:**
- Consumes: `docs/upstream/state.json` (Task 1 field names).
- Produces: the maintainer-invocable workflow Task 3 executes.

- [ ] **Step 1: Write the skill file**

Create `.claude/skills/upstream-sync/SKILL.md` with exactly this content:

````markdown
---
name: upstream-sync
description: Scan the OpenWiki upstream (langchain-ai/openwiki) for changes relevant to claude-wiki and produce an adaptation report with apply proposals. Maintainer-only. Triggers - "upstream sync", "업스트림 동기화", "openwiki 변경 확인", "openwiki 업스트림".
---

# OpenWiki Upstream Sync

Maintainer workflow for picking up relevant upstream changes. claude-wiki ports OpenWiki's code mode into prompt markdown; this skill keeps that port from drifting.

## Hard rules

- The clone at `localClonePath` is **read-only**: `git fetch`, `log`, `show`, `diff`, `rev-parse`, `cat-file` only. Never checkout, reset, commit, clean, or write there.
- Never copy upstream TypeScript into claude-wiki source. Upstream behavior changes are translated into edits to `skills/wiki-generation/SKILL.md`, `commands/*.md`, `examples/`, or docs.
- Write only under `docs/upstream/` plus the claude-wiki files named in maintainer-approved proposals.
- OpenWiki is MIT-licensed; every report entry cites the upstream commit sha.

## Workflow

### 1. Locate and fetch

Read `docs/upstream/state.json` (fields: `upstreamRepo`, `localClonePath`, `lastReviewedCommit`, `lastRunAt`). Expand `~` in `localClonePath`. If the clone does not exist, stop and tell the maintainer to run `git clone git@github.com:langchain-ai/openwiki.git <localClonePath>`. Then:

```sh
git -C <clone> fetch origin
```

### 2. Scope

```sh
git -C <clone> log --oneline --no-merges <lastReviewedCommit>..origin/main
```

- Empty range → **no-op run**: skip to step 7, report "관련 업스트림 변경 없음".
- `lastReviewedCommit` unknown to git (`git -C <clone> cat-file -e <sha>` fails — history rewrite): fall back to snapshot comparison — `git -C <clone> diff` the relevance-surface paths (step 3 table) from the sha recorded in the most recent `docs/upstream/*-openwiki-sync.md` report to `origin/main`, treat the whole diff as one candidate, and state in the report that the fallback was used.

### 3. Classify (cheap pass — names only, no diffs yet)

```sh
git -C <clone> log --no-merges --format='--- %h %s' --name-only <lastReviewedCommit>..origin/main
```

Bucket each commit by its paths and message:

| Relevant upstream surface | claude-wiki home for the change |
|---|---|
| `src/agent/prompt.ts` (generation discipline, page rules) | `skills/wiki-generation/SKILL.md` |
| `src/code-mode.ts`, init/update + metadata semantics | `skills/wiki-generation/SKILL.md` modes; `claude-wiki.json` contract (also README + `docs/IMPLEMENTATION.md` if the contract shifts) |
| openwiki output layout, `INSTRUCTIONS.md`, `CLAUDE.md` marker block | `skills/wiki-generation/SKILL.md` openwiki format spec |
| CI/workflow examples for scheduled wiki updates | `examples/claude-wiki-update.yml` |

**Auto-skip** (list one line each in the report, no diff reading): `src/connectors/`, `src/auth/`, schedules/personal mode, model options, TUI/`cli.tsx`, deepagents/SDK plumbing, release/version bumps, and tests/docs for skipped areas.

### 4. Judge candidates

For each candidate commit, read the diff — targeted, relevant paths only:

```sh
git -C <clone> show <sha> -- <relevant paths>
```

If the rationale is unclear and the message references a PR, optionally `gh pr view <N> --repo langchain-ai/openwiki --json title,body`. Verdict per commit:

- **adopt** — port the change as-is (e.g. a prompt-wording improvement).
- **adapt** — semantic translation required (e.g. TypeScript behavior → a SKILL.md instruction).
- **skip** — relevant surface but not applicable to claude-wiki; record why.

### 5. Report

Zero adopt/adapt verdicts → no report file; go to step 7. Otherwise write `docs/upstream/YYYY-MM-DD-openwiki-sync.md`:

```markdown
# OpenWiki Upstream Sync — YYYY-MM-DD

Range: <lastReviewedCommit-short>..<origin/main-short> (<N> commits; <K> candidates; <M> proposals)

## Proposals

### <upstream sha-short> <upstream commit title>
- **Verdict:** adopt | adapt
- **Upstream change:** <what changed, 1-3 sentences>
- **Why it matters here:** <link to the ported surface>
- **Proposed edit:** `<claude-wiki file>` — <the concrete edit, quoted text where possible>

## Skipped (relevant surface, not applicable)
- <sha-short> <title> — <reason>

## Auto-skipped (out of scope)
- <sha-short> <title>
```

### 6. Approve and apply

Present each proposal to the maintainer with AskUserQuestion (multiSelect; batch of at most 4 per question). Apply **only** approved proposals. Then run the verify ladder per `.claude/skills/verify/SKILL.md`: fast gate always; if `skills/wiki-generation/SKILL.md` changed, ask before running `npm run test:e2e` (real tokens). Record applied/deferred status per proposal in the report.

### 7. Finish

Update `docs/upstream/state.json`: `lastReviewedCommit` = `git -C <clone> rev-parse origin/main`, `lastRunAt` = current UTC ISO-8601 — **even on a no-op run**. Commit the report, state file, and applied edits (logical commits), and push.
````

- [ ] **Step 2: Sanity-check discoverability and gate**

```bash
head -4 .claude/skills/upstream-sync/SKILL.md
npm run lint && npm test
```

Expected: frontmatter opens with `---` and contains `name: upstream-sync`; lint/test untouched and green.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/upstream-sync/SKILL.md
git commit -m "feat: add maintainer upstream-sync skill for OpenWiki pickup"
```

---

### Task 3: Acceptance — one real sync run (MAIN SESSION ONLY)

**Files:**
- Create: `docs/upstream/<today>-openwiki-sync.md` (by following the skill)
- Modify: `docs/upstream/state.json`; any claude-wiki files in approved proposals

**Interfaces:**
- Consumes: Task 1 state file, Task 2 skill.
- This task is interactive (AskUserQuestion with the maintainer) — the controller executes it inline; do not dispatch a subagent.

- [ ] **Step 1: Execute the skill end-to-end** over `lastReviewedCommit..origin/main` exactly as written in `.claude/skills/upstream-sync/SKILL.md` (the range includes at least #264's INSTRUCTIONS.md relocation — expected to be a candidate).

- [ ] **Step 2: Maintainer approval gate** — present proposals via AskUserQuestion, apply approved ones, run the verify ladder (fast gate; E2E only with maintainer consent if `skills/wiki-generation/SKILL.md` changed).

- [ ] **Step 3: Close out**

```bash
npm run check-links -- wiki
git add docs/upstream/ <applied files>
git commit -m "docs: first openwiki upstream sync run"
git push origin main
```

Expected: report + updated state committed; CI green on the push. If the run surfaced skill-workflow bugs (wrong command, unclear step), fix `.claude/skills/upstream-sync/SKILL.md` in the same commit series.

---

## Post-plan note

`wiki/` gets no edit in this plan: the skill is maintainer tooling, not product architecture. If the acceptance run's approved proposals change `skills/wiki-generation/SKILL.md` substantively, run `/claude-wiki:update` afterwards as a separate step.
