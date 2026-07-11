---
description: Incrementally refresh the agent-friendly wiki for this repository
---

# /agentwiki:update

Incrementally update the existing wiki based on changes since the last run.

**TODO(implementation):** This command will:

1. Read `agentwiki.json` to find the last documented commit and format.
2. Diff the repository against that commit to scope the update.
3. Invoke the `wiki-generation` skill in update mode to revise only affected pages.
4. Update `agentwiki.json` metadata.
