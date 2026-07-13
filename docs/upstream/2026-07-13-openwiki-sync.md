# OpenWiki Upstream Sync — 2026-07-13

Range: 326a307..2fb44a8 (6 commits; 3 candidates; 2 proposals)

## Proposals

### 2fb44a8 feat: track deferred documentation areas (#286)
- **Verdict:** adapt
- **Upstream change:** `src/agent/prompt.ts` now requires a coverage self-check: areas dropped by the page budget go into a concise `## Backlog` section at the end of the entry page (area name, source anchor, one-line reason; no separate backlog page). Init must not silently drop a real domain because of the 8-page budget; update reads the backlog first, promotes entries when the diff touches that area or budget allows, and forbids silent backlog growth.
- **Why it matters here:** Our `skills/wiki-generation/SKILL.md` is the direct port of that prompt — same page budget, same init/update modes, same silent-drop risk.
- **Proposed edit:** `skills/wiki-generation/SKILL.md` — three additions: (1) in "Page and section quality", a coverage self-check bullet requiring every identified area to be documented or backlogged in a `## Backlog` section at the end of the entry page with area name, source anchor, and one-line reason; (2) in Mode: init, after the 8-page budget rule: "Do not silently drop a real domain or workflow because of the page budget — record it in the entry page's `## Backlog` section instead."; (3) in Mode: update: read the existing `## Backlog` first if present, promote an entry when the diff touches that area or the run has spare budget (document it, remove the entry), and never let the backlog grow silently.
- **Status:** applied (2026-07-13)

### 8014247 feat: add Bitbucket Pipelines example for openwiki --update (#261)
- **Verdict:** adapt (optional)
- **Upstream change:** Adds `examples/openwiki-update.bitbucket-pipelines.yml`, a Bitbucket Pipelines equivalent of the GitHub Actions/GitLab CI examples, linked from the README.
- **Why it matters here:** We ship only a GitHub Actions template (`examples/claude-wiki-update.yml`); Bitbucket users have no starting point. Same CI-examples surface we ported.
- **Proposed edit:** create `examples/claude-wiki-update.bitbucket-pipelines.yml` (scheduled pipeline: install `@anthropic-ai/claude-code` + `claude-wiki`, run `claude-wiki update` with `CLAUDE_CODE_OAUTH_TOKEN`, push a branch / open a PR via Bitbucket API) and link it from README's Headless/CI section.
- **Status:** deferred (maintainer declined this round)

## Skipped (relevant surface, not applicable)
- 62b657d docs: pin OpenRouter provider in CI examples (#253) — provider-selection env (`OPENWIKI_PROVIDER`) has no claude-wiki equivalent; we have exactly one provider (the local `claude` CLI).

## Auto-skipped (out of scope)
- 9576f07 docs: update OpenWiki (#283) — upstream's own generated wiki content.
- 14f1281 fix: escape carriage returns in env value formatting/parsing (#248) — env plumbing for provider/connector config.
- bc87f4f test: add coverage for src/env.ts runtime behavior (#173) — tests for a skipped area.
