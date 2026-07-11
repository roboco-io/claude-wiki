# AgentWiki

AgentWiki generates and maintains **agent-friendly wikis** for codebases using [Claude Code](https://claude.com/claude-code) — powered by your existing **Claude subscription, no API key required**.

Inspired by [OpenWiki](https://github.com/langchain-ai/openwiki), rebuilt on top of Claude Code so that documentation generation runs inside your Claude Pro/Max subscription instead of requiring separate API credentials.

## How it works

Anthropic's policy does not allow the Claude Agent SDK to use claude.ai subscription auth. AgentWiki therefore takes a different architecture:

- **Claude Code plugin** — the wiki generation logic lives in plugin commands, skills, and subagents that run *inside* your Claude Code session (fully covered by your subscription).
- **Thin CLI wrapper** — `agentwiki` shells out to the locally installed `claude` CLI in headless mode (`claude -p`), so the same logic works from your terminal or CI. In CI, use a long-lived OAuth token from `claude setup-token` (`CLAUDE_CODE_OAUTH_TOKEN`).

## Install

### As a Claude Code plugin

```
/plugin install agentwiki@roboco-io
```

Then inside any repository:

```
/agentwiki:init      # generate the initial wiki
/agentwiki:update    # incrementally refresh the wiki
```

### As a CLI

```sh
npm install -g agentwiki

agentwiki init       # generate the initial wiki
agentwiki update     # incrementally refresh the wiki
```

Requires the [Claude Code CLI](https://claude.com/claude-code) to be installed and logged in.

## Output formats

AgentWiki supports two wiki layouts, selectable at init time:

| Format | Layout | Best for |
|--------|--------|----------|
| `llm-wiki` (default) | `wiki/index.md` + `[[wiki-link]]` cross-references (Karpathy LLM Wiki pattern, Obsidian-compatible) | Agent-first knowledge bases |
| `openwiki` | `openwiki/quickstart.md` + `architecture/`, `operations/` sections | OpenWiki-compatible repositories |

## Keeping the wiki fresh in CI

Copy [`examples/agentwiki-update.yml`](./examples/agentwiki-update.yml) into `.github/workflows/` to automatically open a PR with documentation updates on a schedule.

## Development

```sh
pnpm install
pnpm build
pnpm test
```

See [docs/DESIGN.md](./docs/DESIGN.md) for architecture decisions.

## License

MIT
