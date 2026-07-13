---
name: verify
description: Verify claude-wiki changes — fast gate always; local E2E only when wiki-generation behavior changed
---

# Verifying claude-wiki changes

## Fast gate (always run)

```sh
npm run build && npm run typecheck && npm run lint && npm test && npm run check-links -- wiki
```

All five must pass before claiming any change works. `check-links` validates this repo's own `wiki/`.

## E2E gate (conditional)

Run `npm run test:e2e` **only when the diff touches wiki-generation behavior**:

- `skills/wiki-generation/SKILL.md`
- `commands/init.md`, `commands/update.md`
- `src/headless.ts` (prompt building, allowed tools, spawn flags)

It builds nothing itself — run `npm run build` first. It spawns real `claude -p` runs against temp fixture repos: **this spends Claude subscription tokens and takes ~5-10 minutes**. In an interactive session, confirm with the user before running it. It is deliberately excluded from `npm test` and CI.

## What E2E covers

`scripts/e2e.mjs`: llm-wiki init (metadata contract, link integrity, `_plan.md` cleanup, source untouched), no-op update (pages byte-identical), openwiki init (quickstart + metadata format).
