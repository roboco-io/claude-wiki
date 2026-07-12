# Claude Wiki

Claude Wiki generates and maintains **agent-friendly wikis** for codebases using Claude Code, powered by the user's existing **Claude Pro/Max subscription — no Anthropic API key**. It is an OpenWiki-inspired rebuild (see `README.md:3-5`) whose defining constraint is that all LLM execution must flow through Claude Code itself, because Anthropic policy forbids subscription auth for Claude Agent SDK products.

This repository is *both* an installable Claude Code plugin (repo root contains `.claude-plugin/plugin.json`) *and* an npm package (`claude-wiki`, currently 0.2.0) providing a thin CLI wrapper.

## What it does

Two operations, exposed identically through the plugin and the CLI:

| Operation | Plugin | CLI | Behavior |
|-----------|--------|-----|----------|
| Init | `/claude-wiki:init [--format llm-wiki\|openwiki]` | `claude-wiki init [--format …]` | Analyze the repo, write a fresh wiki. Refuses if `claude-wiki.json` already exists in `wiki/` or `openwiki/`. |
| Update | `/claude-wiki:update` | `claude-wiki update` | Diff-scoped surgical revision since `lastRunCommit`; may be a no-op. |

Two output formats: `llm-wiki` (default — flat `wiki/` with `[[wiki-link]]` cross-references, Karpathy LLM Wiki pattern, Obsidian-compatible) and `openwiki` (OpenWiki-compatible `openwiki/quickstart.md` + section directories). Details in [[architecture]].

## Where the logic lives

The core design principle (`docs/IMPLEMENTATION.md:11`): **all wiki-generation intelligence is prompt markdown, never TypeScript.**

- `skills/wiki-generation/SKILL.md` — the entire generation workflow: run/git/planning/subagent discipline, both format specs, init/update modes, the `claude-wiki.json` metadata contract.
- `commands/init.md`, `commands/update.md` — thin delegates that parse the format flag and invoke the skill.
- `src/` (3 files, ~180 lines total) — CLI wrapper only: argument parsing, `claude` binary detection, spawning `claude -p` with the skill body inlined as the prompt.
- `scripts/check-links.mjs` — LLM-free link-integrity checker for generated wikis.
- `agents/` — empty placeholder for future specialized subagents.

## Reading order

1. [[architecture]] — why the hybrid plugin+CLI design exists, component responsibilities, headless invocation flow, output-format specs, the metadata contract, and the security model.
2. [[development]] — build/test/lint commands, test layout, publishing history and process, the CI workflow template, and guidance for common changes.

## Key facts an agent should know before changing anything

- **Never** introduce direct Anthropic API or Agent SDK calls — this violates the project's founding constraint (`docs/IMPLEMENTATION.md` "Hard constraints").
- Behavior changes to wiki generation go in `skills/wiki-generation/SKILL.md`, not in `src/`.
- The npm package name history: originally `agentwiki`, renamed to `claude-wiki` at 0.1.0 (npm 403 on similar name) then fully rebranded at 0.2.0 (commit `80c506d`). `HANDOFF.md` records the v0.1 completion state.
- Project docs: `docs/DESIGN.md` (architecture decision record), `docs/IMPLEMENTATION.md` (constraints and specs). Both predate implementation; where they conflict with source, source wins — e.g. DESIGN.md's status line still says "implementation pending", which is stale.
