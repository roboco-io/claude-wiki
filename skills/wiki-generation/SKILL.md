---
name: wiki-generation
description: Analyze a repository and generate or incrementally update an agent-friendly wiki. Used by /agentwiki:init and /agentwiki:update, or when the user asks to generate/refresh codebase documentation as a wiki.
---

# Wiki Generation

**TODO(implementation):** Core wiki generation workflow, ported from OpenWiki's agent prompt design:

- Targeted repository discovery (entrypoints, package/config files, routing, schema, representative domain files) — never exhaustive full-repo reads.
- Ground every claim in inspected source files or git evidence; never invent behavior.
- Two output formats:
  - `llm-wiki`: `wiki/index.md` + `[[wiki-link]]` cross-references (Karpathy LLM Wiki pattern, Obsidian-compatible).
  - `openwiki`: `openwiki/quickstart.md` + section directories (`architecture/`, `operations/`, ...).
- Init mode: strong, focused first pass — quickstart/index plus the smallest set of section pages.
- Update mode: diff-scoped revision of affected pages only.
