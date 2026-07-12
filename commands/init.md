---
description: Generate the initial agent-friendly wiki for this repository
argument-hint: "[--format llm-wiki|openwiki]"
---

# /claude-wiki:init

Generate the initial wiki for the current repository.

Arguments: `$ARGUMENTS`

1. Determine the output format from the arguments above: `--format openwiki` selects `openwiki`; `--format llm-wiki` or no format flag selects `llm-wiki` (the default). Any other `--format` value: stop and report that valid values are `llm-wiki` and `openwiki`.
2. Load and follow the `wiki-generation` skill in **init** mode with the chosen format. The skill defines the entire workflow, including preconditions and writing the `claude-wiki.json` metadata file — do not duplicate or skip any of its steps.
