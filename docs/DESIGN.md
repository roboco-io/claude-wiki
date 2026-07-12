# Claude Wiki Design

Date: 2026-07-12
Status: draft (structure-only skeleton committed; implementation pending)

## Goal

Rebuild the core of [OpenWiki](https://github.com/langchain-ai/openwiki) (LangChain's deepagents-based wiki CLI) so it runs on a **Claude subscription only** — no Anthropic API key.

## Key constraint discovered

The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) **cannot** use claude.ai subscription auth — Anthropic policy requires API keys for SDK-based products ([Agent SDK quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart.md)). Subscription auth is only valid for Claude Code itself.

## Architecture decision

Hybrid **plugin-first** design:

| Component | Role | Auth |
|-----------|------|------|
| Claude Code plugin (`commands/`, `skills/`, `agents/`) | All wiki-generation logic as prompts/skills running inside Claude Code | User's subscription |
| Thin CLI (`src/cli.ts`, npm `claude-wiki`) | Shells out to `claude -p` headless mode for terminal/CI use | User's subscription (local login) or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` (CI) |

This keeps subscription usage within Claude Code (policy-compliant) while preserving OpenWiki's CLI/CI ergonomics.

## Scope decisions

- **Code mode only.** OpenWiki's personal mode (Gmail/Notion/X/Slack connectors, OAuth, scheduler) is out of scope.
- **Two output formats**, selectable at init:
  - `llm-wiki` (default): `wiki/index.md` + `[[wiki-link]]` cross-references (Karpathy LLM Wiki pattern, Obsidian-compatible).
  - `openwiki`: `openwiki/quickstart.md` + section directories, compatible with OpenWiki-generated repos.
- **Incremental updates** driven by `claude-wiki.json` metadata (last documented commit + format), diff-scoped.
- **CI workflow** example for GitHub Actions (`examples/claude-wiki-update.yml`).

## What we port from OpenWiki

From `openwiki/src/agent/prompt.ts`, the run-discipline principles:

- Targeted discovery (entrypoints, package/config, routing, schema, representative domain files) — no exhaustive reads, no `**/*` globs.
- Ground every claim in inspected evidence; never invent behavior.
- Init: focused first pass (quickstart/index + smallest useful page set), refine in later updates.
- Update: metadata-driven, diff-scoped page revision.

## Repository layout

```
claude-wiki/
├── .claude-plugin/plugin.json   # plugin manifest (repo root = installable plugin)
├── commands/                    # /claude-wiki:init, /claude-wiki:update
├── skills/wiki-generation/      # core generation workflow
├── agents/                      # (future) specialized subagents
├── src/cli.ts                   # thin CLI wrapper → claude -p
├── examples/                    # CI workflow templates
├── docs/                        # design docs
└── test/
```
