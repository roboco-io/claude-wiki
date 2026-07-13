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
