# Upstream Sync Skill Design

Date: 2026-07-13
Status: approved

## Goal

A maintainer-only Claude Code skill that scans the OpenWiki upstream (langchain-ai/openwiki) for changes relevant to claude-wiki, produces an analysis report with concrete adaptation proposals, and applies only the proposals the maintainer approves.

## Background

claude-wiki is a subscription-only rebuild of OpenWiki's code mode. Its generation discipline was ported from `openwiki/src/agent/prompt.ts` into `skills/wiki-generation/SKILL.md`, and its `openwiki` output format promises compatibility with OpenWiki-generated repos. Upstream keeps evolving (e.g. #264 moved INSTRUCTIONS.md into `openwiki/`); without a systematic pickup process, the port drifts.

## Placement and audience

- Skill file: `.claude/skills/upstream-sync/SKILL.md` — repo-local, maintainer-only. **Not** part of the plugin distribution (`package.json` `files` and the plugin layout are untouched).
- Reports and state: `docs/upstream/`.

## State file: `docs/upstream/state.json`

```json
{
  "upstreamRepo": "langchain-ai/openwiki",
  "localClonePath": "~/Workspace/opensource/openwiki",
  "lastReviewedCommit": "<openwiki sha>",
  "lastRunAt": "<UTC ISO-8601>"
}
```

Committed to the repo (same idiom as `claude-wiki.json`). Initial baseline: the openwiki `origin/main` commit as of 2026-07-12 (the port date), resolved during implementation with `git rev-list -1 --before=2026-07-12 origin/main`.

## Skill workflow

1. **Locate clone.** Read `state.json`; expand `localClonePath`. If the clone is missing, stop and tell the maintainer to `git clone git@github.com:langchain-ai/openwiki.git` there. The clone is read-only: fetch only, never checkout/reset/modify it.
2. **Fetch.** `git fetch origin` in the clone.
3. **Scope.** `git log --oneline lastReviewedCommit..origin/main`. If `lastReviewedCommit` is unknown to git (history rewrite), fall back to snapshot comparison: diff the relevance-map files between their last-reviewed content (from the most recent report) and `origin/main`, and say the fallback was used.
4. **Classify** each commit by paths and message against the relevance map:
   - **Relevant surface** (→ claude-wiki home):
     - `src/agent/prompt.ts` → `skills/wiki-generation/SKILL.md` (run/git/docs discipline, page structure rules)
     - code-mode init/update semantics (`src/code-mode.ts`, metadata handling) → `skills/wiki-generation/SKILL.md` modes + `claude-wiki.json` contract
     - openwiki output layout/INSTRUCTIONS.md/marker-block behavior → `skills/wiki-generation/SKILL.md` openwiki format spec
     - CI/workflow examples for wiki updates → `examples/claude-wiki-update.yml`
   - **Irrelevant (auto-skip, listed one line each):** connectors, auth/OAuth, scheduler/personal mode, model options, TUI/CLI cosmetics, deepagents/SDK plumbing, release/version bumps.
5. **Judge** candidate commits by reading their diffs (`git show` in the clone): verdict per commit — **adopt** (port as-is), **adapt** (semantic translation needed, e.g. TypeScript behavior → prompt instruction), or **skip** (with reason).
6. **Report** to `docs/upstream/YYYY-MM-DD-openwiki-sync.md`: per relevant commit — upstream sha/title, what changed, why it matters to claude-wiki, the exact target file and proposed edit text. Skipped commits as a one-line list. If zero relevant commits: no report file; just update state (no-op run).
7. **Approve & apply.** Present proposals via AskUserQuestion (multiSelect). Apply only approved ones. Then run the verify ladder (`.claude/skills/verify/SKILL.md`): fast gate always; if `skills/wiki-generation/SKILL.md` changed, E2E after user confirmation.
8. **Finish.** Update `state.json` `lastReviewedCommit` to the reviewed `origin/main` sha (even on no-op), commit report + state + applied edits.

## Constraints

- Never copy upstream code verbatim into claude-wiki TypeScript — claude-wiki's intelligence lives in prompt markdown (project hard constraint); upstream changes are translated into prompt/doc edits. OpenWiki is MIT-licensed; reports cite upstream commits.
- The skill only writes under `docs/upstream/`, the claude-wiki files named in approved proposals, and `state.json`.
- No network beyond `git fetch` on the clone (and `gh` lookups of openwiki PRs if a commit message references one).

## Out of scope

- Automation (cron/CI) — manual maintainer invocation only.
- Syncing claude-wiki → openwiki (one direction only).
- Plugin distribution of this skill.

## Acceptance

Implementation ends with one real run over the currently-unreviewed range (baseline → current `origin/main`, which includes e.g. #264's INSTRUCTIONS.md relocation) producing a report the maintainer reviews; approved proposals applied and gates green.
