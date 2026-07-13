# Development

Back to [[index]] · Related: [[architecture]]

## Toolchain and commands

Node ≥ 20, ESM, TypeScript, zero runtime dependencies (dev-only: typescript, tsx, vitest, eslint, typescript-eslint). From `package.json`:

```sh
npm run build        # tsc → dist/ (prebuild cleans dist)
npm test             # vitest run (22 unit tests)
npm run test:e2e     # node scripts/e2e.mjs — local-only, spends real tokens
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run dev          # tsx src/cli.ts (run CLI without building)
npm run check-links  # node scripts/check-links.mjs <wiki-dir>
```

Lint uses eslint 10 + typescript-eslint flat config (`eslint.config.mjs`); the full gate is build + typecheck + lint + test.

## Tests

Three vitest suites under `test/`:

- `args.test.ts` — argument parsing: format validation, unknown options, help/error paths.
- `headless.test.ts` — `buildPrompt()` (skill frontmatter stripping, mode instruction) and package-root resolution.
- `check-links.test.ts` — link checker behavior, including the regression tests for ignoring code spans and fenced blocks (commit `03dfadd`).

E2E is automated locally via `npm run test:e2e` (`scripts/e2e.mjs` — spends real Claude subscription tokens; when to run it is codified in `.claude/skills/verify/SKILL.md`). It is deliberately excluded from `npm test` and CI. The script builds temp fixture repos and runs the built CLI against them: llm-wiki init (metadata contract, link integrity via `checkWiki`, `_plan.md` cleanup, fixture source untouched), a no-op `update` (pages byte-identical), and openwiki init. Exit codes: 0 all-pass, 1 failures, 2 preconditions missing (`dist/` not built or `claude` CLI absent). Interactive plugin E2E still uses `claude --plugin-dir <repo>` in a real session.

## The link checker: `scripts/check-links.mjs`

LLM-free validator for generated wikis. Checks three things: every `[[wiki-link]]` target exists as a `.md` file, every relative Markdown link resolves, and (llm-wiki format, when `index.md` exists) every page is reachable from `index.md` — orphans are errors. Code spans and fenced blocks are stripped first so prose examples like `[[wiki-link]]` in backticks don't count. Exits 0 on OK, 1 on problems, 2 on usage error. It exports `checkWiki(root)` for the unit tests and only runs its CLI block when invoked directly.

## Publishing

Two distribution channels, both from this single repo:

1. **npm** — package `claude-wiki`, bin `claude-wiki` → `dist/cli.js`. The `files` field ships `dist` *plus* the plugin dirs (`commands`, `skills`, `agents`, `scripts`, `.claude-plugin`) because the CLI reads `skills/wiki-generation/SKILL.md` at runtime from the installed package (see [[architecture]] on prompt inlining). Current: 0.2.0; 0.1.0 is deprecated (rebrand from `agentwiki` — the original name was rejected by npm as too similar to an existing package).
2. **Plugin marketplace** — registered in `roboco-io/plugins` marketplace.json as a github source (2026-07-13). Install: `/plugin marketplace add roboco-io/plugins` then `/plugin install claude-wiki@roboco-plugins`.

## CI

This repo runs its own fast gate on every push to `main` and every PR: `.github/workflows/ci.yml` (Node 20) does `npm ci` → build → typecheck → lint → test → `check-links -- wiki` (validating this repo's own generated wiki). E2E is never run in CI.

## CI template: `examples/claude-wiki-update.yml`

A copyable GitHub Actions workflow (not active in this repo): weekly cron + manual dispatch, `fetch-depth: 0` checkout (update mode needs history to diff from `lastRunCommit`), installs `@anthropic-ai/claude-code` + `claude-wiki` globally, runs `claude-wiki update` with the `CLAUDE_CODE_OAUTH_TOKEN` secret, and opens a PR via `peter-evans/create-pull-request`.

## Guidance for common changes

- **Changing generation behavior** (page structure, disciplines, formats): edit `skills/wiki-generation/SKILL.md` only. Never move logic into TypeScript — see [[index]] "Key facts".
- **Changing CLI flags**: `src/args.ts` + `test/args.test.ts`; update the `HELP` string in `src/cli.ts` and the README usage section.
- **Adding a tool the skill needs in headless mode**: extend `ALLOWED_TOOLS` in `src/headless.ts` — an omission here makes headless runs silently degrade or hang on permission.
- **Changing the `claude-wiki.json` schema**: it appears in the skill, README, `docs/IMPLEMENTATION.md`, and consumers' generated wikis — bump `version` and keep all three docs in sync.
- **After changing skill/command markdown or `src/headless.ts`**: run `npm run test:e2e` before publishing — the verification ladder (fast gate always, E2E conditionally) is codified in `.claude/skills/verify/SKILL.md`.
- **Releasing**: full gate + `test:e2e`, then `npm publish`, and remember the marketplace entry in `roboco-io/plugins` points at the GitHub repo (no separate publish step, but plugin.json `version` should track package.json).
