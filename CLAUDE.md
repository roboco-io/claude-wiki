# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Wiki first

This repo maintains its own generated wiki. Start at `wiki/index.md` and follow `[[wiki-links]]` before exploring raw source — it covers architecture, the metadata contract, and change guidance. Refresh it with `/claude-wiki:update` after substantive changes.

## Commands

```sh
npm run build        # tsc → dist/ (prebuild cleans dist)
npm test             # vitest run — all unit tests
npx vitest run test/args.test.ts   # single test file
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run dev          # run the CLI from source (tsx src/cli.ts)
npm run check-links  # validate a generated wiki: node scripts/check-links.mjs <wiki-dir>
```

The full gate is build + typecheck + lint + test. E2E is manual: run `node dist/cli.js init` against a small repo, verify output with `check-links.mjs` (procedure in HANDOFF.md).

## Hard constraints (do not violate)

1. **No Anthropic API key, no Agent SDK.** All LLM execution must go through Claude Code — interactive plugin commands or headless `claude -p`. Subscription auth is the entire point of this project (docs/DESIGN.md, docs/IMPLEMENTATION.md "Hard constraints").
2. **All wiki-generation intelligence lives in prompt markdown** (`skills/wiki-generation/SKILL.md`), never in TypeScript. The CLI only parses args, detects the `claude` binary, and spawns it.
3. **Zero runtime dependencies** in the CLI — Node ≥ 20 built-ins only, ESM.

## Architecture

One repo, two distribution channels sharing one brain:

- **Claude Code plugin** (repo root is the plugin; `.claude-plugin/plugin.json`): `commands/init.md` and `commands/update.md` are thin delegates into `skills/wiki-generation/SKILL.md`, which defines the entire workflow — discovery/git/planning discipline, both output formats (`llm-wiki` flat + `[[wiki-link]]`; `openwiki` sectioned), init/update modes, and the `claude-wiki.json` metadata contract.
- **npm CLI** (`claude-wiki`, `src/` → `dist/cli.js`): `headless.ts` reads the packaged SKILL.md, strips its frontmatter, and inlines the body directly into a `claude -p` prompt with `--permission-mode acceptEdits` and a narrow `--allowedTools` list. This is why headless and interactive behavior are identical, and why `package.json` `files` must ship the plugin dirs alongside `dist`.

Consequences for changes:

- Generation behavior → edit SKILL.md only. New tool needed by the skill → also extend `ALLOWED_TOOLS` in `src/headless.ts`, or headless runs stall on permission prompts.
- `claude-wiki.json` schema changes → bump `version`; the schema is documented in SKILL.md, README, and docs/IMPLEMENTATION.md — keep them in sync.
- `update` scopes its diff from the metadata's `lastRunCommit`; `init` refuses to run when metadata exists in either `wiki/` or `openwiki/`.

## Security model

Headless runs auto-approve file edits (acceptEdits); the "write only under the wiki root" rule is prompt-enforced, not sandboxed. Only run against trusted repositories; generated changes should be reviewed before merge (README "Security model").
