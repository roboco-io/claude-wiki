---
description: Incrementally refresh the agent-friendly wiki for this repository
---

# /agentwiki:update

Incrementally update the existing wiki based on changes since the last documented run.

Load and follow the `wiki-generation` skill in **update** mode. The skill defines the entire workflow: locating `agentwiki.json` (falling back to full init behavior when it is missing), diff-scoping the revision, editing surgically, and rewriting the metadata file. Do not duplicate or skip any of its steps. The format is whatever the metadata file records.
