---
description: Generate the initial agent-friendly wiki for this repository
argument-hint: "[--format llm-wiki|openwiki]"
---

# /agentwiki:init

Generate the initial wiki for the current repository.

**TODO(implementation):** This command will:

1. Detect the requested output format from `$ARGUMENTS` (default: `llm-wiki`).
2. Invoke the `wiki-generation` skill to analyze the repository and produce the wiki.
3. Write an `agentwiki.json` metadata file recording the format, generation timestamp, and HEAD commit for incremental updates.
