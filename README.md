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

## Usage

Both interfaces expose the same two operations. `init` requires no flags for the default format; `update` takes none at all — it reads the format from the existing wiki's metadata.

```sh
# Plugin (inside a Claude Code session)
/agentwiki:init                        # generate wiki/ (llm-wiki format, default)
/agentwiki:init --format openwiki      # generate openwiki/ instead
/agentwiki:update                      # refresh the existing wiki

# CLI (terminal or CI)
agentwiki init                         # same as above
agentwiki init --format openwiki
agentwiki update
```

`init` refuses to run if the target wiki root already has an `agentwiki.json` (run `update` instead, or delete the wiki root to force a rebuild). `update` is diff-scoped from the last recorded commit and may be a no-op if nothing relevant changed since then.

### Headless / CI usage

The CLI shells out to your local `claude` binary in headless mode (`claude -p`), so it needs the Claude Code CLI installed and authenticated:

- **Locally**: log in once with `claude login`; `agentwiki` reuses that session.
- **In CI**: generate a long-lived OAuth token with `claude setup-token` (works with a Claude Pro/Max subscription, no API key), store it as a secret, and export it as `CLAUDE_CODE_OAUTH_TOKEN`. See [`examples/agentwiki-update.yml`](./examples/agentwiki-update.yml) for a complete GitHub Actions workflow that installs `@anthropic-ai/claude-code` + `agentwiki`, runs `agentwiki update` on a schedule, and opens a PR with the changes.

```sh
export CLAUDE_CODE_OAUTH_TOKEN=...   # from `claude setup-token`
agentwiki update
```

### The `agentwiki.json` metadata contract

Every generated wiki root (`wiki/` or `openwiki/`) contains an `agentwiki.json` file that `update` reads and rewrites on every run, including no-ops:

```json
{
  "version": 1,
  "format": "llm-wiki",
  "lastRunCommit": "<git HEAD sha at generation time>",
  "lastRunAt": "<UTC timestamp, e.g. 2026-07-12T00:00:00Z>"
}
```

`format` determines the wiki layout regardless of which directory it's found in; `lastRunCommit` scopes the diff that the next `update` inspects.

## Why no API key

All wiki-generation intelligence runs as Claude Code skill/command prompts executed by your local `claude` binary, so token usage is covered by your Claude Pro/Max subscription instead of a separate Anthropic API key.

## Development

```sh
pnpm install
pnpm build
pnpm test
```

See [docs/DESIGN.md](./docs/DESIGN.md) for architecture decisions.

## License

MIT
