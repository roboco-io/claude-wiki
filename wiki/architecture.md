# Architecture

Back to [[index]] · Related: [[development]]

## The constraint that shaped everything

The Claude Agent SDK cannot use claude.ai subscription auth — Anthropic policy requires API keys for SDK-based products (`docs/DESIGN.md:10-12`, quoting the Agent SDK quickstart). Since the project's goal is "runs on a Claude subscription only", the SDK route OpenWiki takes (deepagents) was off the table. The resulting decision (`docs/DESIGN.md:14-23`):

| Component | Role | Auth |
|-----------|------|------|
| Claude Code plugin (`commands/`, `skills/`) | All wiki-generation logic as prompts running inside Claude Code | User's subscription |
| Thin CLI (`src/`, npm bin `claude-wiki`) | Shells out to `claude -p` headless mode for terminal/CI use | Local login, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` in CI |

Scope deliberately excludes OpenWiki's "personal mode" (Gmail/Notion/Slack connectors, OAuth, scheduler) — code mode only.

## Component walkthrough

### The skill: `skills/wiki-generation/SKILL.md`

The single source of truth for generation behavior. It defines:

- **Run discipline** — targeted discovery only (no `**/*` globs, no exhaustive reads), evidence-grounded claims, `rg --files` with excludes.
- **Git discipline** — use history to explain *why* code exists; account for uncommitted changes.
- **Planning discipline** — write `<wiki-root>/_plan.md` before authoring pages, delete it before finishing.
- **Two modes** — `init` (fresh build, precondition: no existing `claude-wiki.json` in either wiki root) and `update` (diff-scoped from `lastRunCommit`, surgical edits, no-op allowed).
- **Security boundaries** — never read secrets; write only under the wiki root (with one openwiki-format exception for a pre-existing `CLAUDE.md` marker block).

### The commands: `commands/init.md`, `commands/update.md`

Thin delegates. `init.md` parses `--format` (rejecting values other than `llm-wiki`/`openwiki`) and invokes the skill in init mode; `update.md` invokes update mode, format read from metadata. All workflow steps live in the skill — the commands explicitly say not to duplicate or skip them.

### The CLI: `src/args.ts` → `src/headless.ts` → `src/cli.ts`

- `args.ts` — pure argument parser returning a discriminated union (`init`/`update`/`help`/`error`). Validates `--format` against the same two values.
- `headless.ts` — the interesting part. `buildPrompt()` reads the plugin's own `SKILL.md`, strips its YAML frontmatter, and appends a mode instruction — the skill body is **inlined directly into the `-p` prompt** (`src/headless.ts:28-34`). This is why headless and interactive behavior are identical without requiring the plugin to be installed in headless mode. `runHeadless()` probes for the `claude` binary (`claude --version`), then spawns `claude -p <prompt> --permission-mode acceptEdits --allowedTools <list>` with inherited stdio.
- `cli.ts` — entry point; maps parse results to exit codes (2 for usage errors, child exit code otherwise).

The allowed-tools list (`src/headless.ts:7-8`) is deliberately narrow: `Read,Glob,Grep,Write,Edit,Task,Bash(git:*),Bash(rg:*),Bash(rm:*),Bash(date:*)` — exactly what the skill's workflow needs (`rm` for `_plan.md` cleanup, `date` for the metadata timestamp).

Zero runtime dependencies — only `node:child_process`, `node:fs`, `node:path`, `node:url`. This is an explicit constraint (`docs/IMPLEMENTATION.md:10`).

## Output formats

| | `llm-wiki` (default) | `openwiki` |
|---|---|---|
| Root / entry | `wiki/index.md` | `openwiki/quickstart.md` |
| Layout | flat kebab-case topic pages | section directories (`architecture/`, `operations/`, …) |
| Cross-links | `[[wiki-link]]` (Obsidian-compatible) | relative Markdown links |

Both roots carry a `claude-wiki.json`. Rules that generation must respect: every llm-wiki page linked from `index.md` (no orphans); openwiki section dirs only when they'll hold multiple substantive pages; small repos get few pages.

## The `claude-wiki.json` contract

Written at the wiki root after **every** run, including no-op updates:

```json
{
  "version": 1,
  "format": "llm-wiki",
  "lastRunCommit": "<git HEAD sha>",
  "lastRunAt": "<UTC ISO-8601>"
}
```

- `format` wins over the directory name when locating the wiki.
- `lastRunCommit` scopes the next update's diff (`git diff --name-only <lastRunCommit>..HEAD`).
- Missing metadata → `update` falls back to full init behavior.
- Existing metadata in *either* root → `init` refuses to run.

## Security model

From `README.md:99-101`: headless runs use `--permission-mode acceptEdits`, so Write/Edit need no per-file confirmation. The "writes stay under the wiki root" rule is enforced **by prompt instructions only**, not OS sandboxing — an adversarial repository could in principle induce writes elsewhere, and repo content is fed to the model. Therefore: only run on trusted repositories, and review generated changes (e.g. the CI-opened PR) before merging. Note a finding from the v0.1 interactive-plugin E2E: even under acceptEdits, `Bash(rg/git/rm)` calls still prompt for permission — acceptEdits only auto-approves file edits.
