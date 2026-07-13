# Dev Harness Design

Date: 2026-07-13
Status: approved

## Goal

Add the missing development harness to claude-wiki: CI, a working lint gate, an automated (local-only) E2E harness, and a project verify skill for agent sessions.

## Components

### 1. CI — `.github/workflows/ci.yml` (new)

- Triggers: push to `main`, pull_request.
- Single job, Node 20 (`actions/setup-node`, npm cache):
  `npm ci` → `npm run build` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run check-links -- wiki` (validates this repo's own generated wiki).
- Does NOT run E2E (subscription token required; E2E is local-only by decision).
- `examples/claude-wiki-update.yml` is a user-facing template and stays untouched.

### 2. Lint — typescript-eslint flat config

- Add devDependencies: `eslint`, `typescript-eslint`.
- New `eslint.config.mjs`: `tseslint.configs.recommended` for `src/**` and `test/**`, plain JS recommended for `scripts/**`; ignore `dist/`, `wiki/`, `node_modules/`.
- Existing `npm run lint` (`eslint .`) then works as-is. Fix any findings it surfaces in existing code.

### 3. E2E harness — `scripts/e2e.mjs` (local-only)

Plain Node script (same idiom as `scripts/check-links.mjs`), wired as `npm run test:e2e`. Requires a built `dist/` and an authenticated local `claude` CLI; fails fast with a clear message when either is missing.

Flow, against a temp fixture repo (a tiny git repo the script creates with a few source files):

1. `node dist/cli.js init` → assert `wiki/index.md` exists, `claude-wiki.json` has `version: 1`, `format: "llm-wiki"`, `lastRunCommit` = fixture HEAD; `_plan.md` absent; `check-links.mjs wiki` passes; fixture source files unmodified.
2. `node dist/cli.js update` with no changes → assert wiki pages byte-identical (metadata timestamp may change), i.e. correct no-op.
3. Fresh fixture, `node dist/cli.js init --format openwiki` → assert `openwiki/quickstart.md` + metadata with `format: "openwiki"`.

Exit 0/1 with a per-step PASS/FAIL summary. Cleans up temp dirs. Not run in CI, not part of `npm test`.

### 4. Verify skill — `.claude/skills/verify/SKILL.md` (new)

Codifies the verification ladder for agent sessions (consumed by the built-in /verify):

- Always: `npm run build && npm run typecheck && npm run lint && npm test && npm run check-links -- wiki`.
- Additionally, when `skills/`, `commands/`, or `src/headless.ts` changed: run `npm run test:e2e` — with an explicit warning that it spends real Claude subscription tokens and takes minutes, so confirm with the user first in interactive sessions.
- CLAUDE.md gets a one-line pointer to the skill in the Commands section.

## Out of scope

- CI-triggered E2E (even manual dispatch) — decided against.
- Hooks-based enforcement.
- Publishing automation.

## Testing the harness itself

- eslint: `npm run lint` passes on the current tree.
- CI: workflow passes on the PR/commit that introduces it.
- E2E script: one full local run of `npm run test:e2e` must pass before the work is called done.
