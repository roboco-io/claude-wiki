---
name: wiki-generation
description: Analyze a repository and generate or incrementally update an agent-friendly wiki. Used by /claude-wiki:init and /claude-wiki:update, or when the user asks to generate/refresh codebase documentation as a wiki.
---

# Wiki Generation

You are an expert technical writer and software architect. Analyze the current repository and produce documentation under the wiki root that is excellent for both humans and future agents. Ground every important claim in source files, existing docs, or git evidence you have inspected. Never invent files, modules, APIs, business rules, or behavior.

## Parameters

The invoking command (or the user) supplies:

- **mode**: `init` (build the wiki from scratch) or `update` (diff-scoped revision).
- **format**: `llm-wiki` (default) or `openwiki`.

Format-dependent paths:

| | `llm-wiki` (default) | `openwiki` |
|---|---|---|
| Wiki root | `wiki/` | `openwiki/` |
| Entry page | `wiki/index.md` | `openwiki/quickstart.md` |
| Layout | flat topic pages | section directories (`architecture/`, `operations/`, ...) |
| Cross-links | `[[topic]]` wiki-links (Obsidian-compatible) | relative Markdown links |
| Metadata | `wiki/claude-wiki.json` | `openwiki/claude-wiki.json` |

## Run discipline

- Do not exhaustively read every file. Inspect: the repository tree, package/config files, README-style files, entrypoints, routing files, database/schema files, and representative files for each major domain.
- Never glob `**/*` from the root. Use targeted discovery by directory and extension. Prefer `rg --files` with excludes for `.git`, `node_modules`, `dist`, `build`, cache directories, and the generated wiki output itself.
- Prefer Grep/Glob and short targeted reads over full-file reads when files are large.
- Do not run commands that read or search outside the target repository.
- Create a strong first pass that is accurate and navigable, then stop. The wiki is refined in later update runs.

## Git discipline

- Use git to explain **why** code exists, not just what it contains.
- During init, inspect recent commit history; use `git log`, `git show`, or `git blame` selectively on important files to understand how major workflows, entrypoints, and business rules evolved.
- Use `git status` and `git diff` to account for uncommitted local changes, especially if they touch existing docs or important source files.
- Do not over-index on ancient history. Focus on recent commits and high-signal history for important files.
- Do not include persistent commit-hash lists in documentation unless a specific historical decision matters for future work.

## Existing documentation discipline

- Treat existing README files, `docs/` trees, root documentation files, runbooks, and SKILL.md files as primary source material.
- Summarize and link to existing docs when they are still useful instead of duplicating them wholesale.
- If existing docs conflict with source code or git history, call out the likely stale documentation and prefer current source evidence.

## Planning discipline

- After discovery and before writing final documentation, create a temporary `<wiki-root>/_plan.md` listing the intended pages, the source evidence for each page, and remaining questions.
- Before completing the run, delete it (`rm -f <wiki-root>/_plan.md`). Never leave it in the final wiki.

## Subagent discipline

- You may use the Task tool (Explore-type, read-only agents) to parallelize research during init or update when the repository has multiple substantial domains.
- Default to 1-2 subagents for large or unfamiliar repositories; use 3-4 only when the repository is clearly small/medium with naturally independent domains, or the user asks for deeper research.
- Subagents must only inspect and summarize — never create, edit, delete, or move files, and never write to the wiki root.
- Give each subagent a narrow brief (existing docs, runtime architecture, data/storage, UI/API surface, integrations, tests, business workflows) and ask for concise findings with source paths and open questions.
- Treat subagent reports as internal notes. You synthesize all final docs and own all writes. Do not paste subagent reports into the final user-facing response.

## Security and write boundaries

- Never read or document secret values, credentials, private keys, tokens, or `.env` files. `.env.example` and similar samples may be read only if they contain placeholders.
- If a secret-bearing file appears relevant, document only that such configuration exists and where non-sensitive setup is described.
- Do not modify source code. Write only under the wiki root, with one exception: in `openwiki` format, if the repository's `CLAUDE.md` already contains an `<!-- OPENWIKI:START -->` ... `<!-- OPENWIKI:END -->` marker block, keep the content between the markers accurate; never create the block yourself.
- In `openwiki` format, `openwiki/INSTRUCTIONS.md` is a user-authored brief. Read it to understand scope and priorities; never rewrite it during normal runs.

## Documentation goals

- Someone with zero knowledge of the repository should start at the entry page and understand what it does, how it is organized, and where to go next.
- A future agent should be able to answer questions and make high-quality updates from the wiki with less raw-source exploration.
- Capture both technical detail and business/product logic; explain why important code exists, not only what files contain.
- Include change-oriented guidance: where to start, what to watch out for, and which tests or checks matter when changing each major area.
- Give each concept one canonical home; link to it from other pages instead of repeating it.
- Organize like human documentation, not a raw file inventory. Source Map sections are optional — add one only when it materially improves navigation; prefer inline source references (`path/to/file.ts:12`) elsewhere.

## Page and section quality

- Avoid thin pages. If a page would mostly be a stub or short note, merge it into the entry page or a broader page.
- For small repositories (about 10 or fewer primary source items), prefer the entry page plus at most 1-2 supporting pages.
- `openwiki` format only: do not create a section directory unless it represents a real documentation area that will hold multiple substantive pages; prefer headings inside broader pages first.
- `llm-wiki` format only: keep pages flat in `wiki/` with kebab-case filenames (`build-pipeline.md`). A `[[wiki-link]]` target is the filename without `.md`. Every page must be linked from `index.md`, and every page should link to its related pages — no orphans.
- Before finishing any run, review the wiki tree; merge or remove low-value pages and stub directories.
- Coverage self-check: before finishing any run, every identified area must be either documented or backlogged. Keep deferred areas in a concise `## Backlog` section at the end of the entry page — do not create a separate backlog page. Each entry records the area name, a source anchor (`path/to/dir` or file), and a one-line reason it was deferred.

## Mode: init

1. Preconditions: confirm the working directory is a git repository (`git rev-parse --is-inside-work-tree`). If `claude-wiki.json` already exists in **either** `wiki/` or `openwiki/` (not just the chosen format's root), stop and tell the user to run `/claude-wiki:update` instead (or delete the existing wiki root to force a rebuild).
2. Build a repository inventory first: existing docs, entrypoints, package/config files, major domain folders, tests, data/schema files, operational scripts.
3. Use git evidence to understand how important files and workflows came to be (recent commits, targeted blame/show on high-signal files).
4. If the repository already has substantial docs, make the wiki an opinionated map and synthesis layer over them.
5. Write the entry page first, then the linked section/topic pages. Use at most 8 pages unless the repository is clearly tiny (then use fewer). Do not silently drop a real domain or workflow because of the page budget — record it in the entry page's `## Backlog` section instead.
6. Do not try to document every source file. Cover the main architecture, workflows, domain concepts, data models, integrations, operations, tests, and extension points.
7. Delete `_plan.md`, then write `<wiki-root>/claude-wiki.json`:

   ```json
   {
     "version": 1,
     "format": "<llm-wiki|openwiki>",
     "lastRunCommit": "<output of git rev-parse HEAD>",
     "lastRunAt": "<output of date -u +%Y-%m-%dT%H:%M:%SZ>"
   }
   ```

8. Final response: list the pages created, name the entry page, and note important caveats or open questions. Do not dump page contents into the response.

## Mode: update

1. Read `<wiki-root>/claude-wiki.json`. Check `wiki/` first, then `openwiki/`; the metadata's `format` field wins over the directory name. **If no metadata file exists in either location, fall back to full init behavior** (using the existing wiki directory's format if one exists, else `llm-wiki`) and say you are doing so.
2. Scope the update: run `git diff --name-only <lastRunCommit>..HEAD` plus `git status --porcelain` for uncommitted changes. If `lastRunCommit` is unknown to git (e.g. shallow clone or history rewrite), say so and scope from the most recent ~20 commits instead.
3. Read the existing `## Backlog` section in the entry page first, if present. Then build a docs impact plan in `_plan.md` before editing: source change → affected page → edit needed → why. If a page cannot be tied to a relevant change, do not edit it.
4. Update runs are surgical. Preserve accurate structure and wording; prefer replacing one stale sentence over adding paragraphs. Only edit pages made inaccurate, incomplete, or misleading by the changes.
5. No formatting-only edits: do not reformat tables, normalize whitespace, reorder lists, or polish wording unless the surrounding content is already being corrected.
6. Soft diff budget: if fewer than ~5 source files changed, edit at most 1-2 pages. Avoid touching the entry page unless top-level behavior, setup, or navigation changed. If you believe more than 3 pages need edits, re-examine the impact plan before proceeding.
7. Add missing pages or remove obsolete claims only when the impact plan demands it; keep entry-page links accurate.
8. Promote a backlog entry when the diff touches that area or the update has spare documentation budget: document the area, then remove the entry. Do not let the backlog grow silently — every identified area must remain either documented or represented by a concise backlog entry with a source anchor and reason.
9. **Updates may be a no-op.** If nothing relevant changed and the wiki is accurate, edit nothing and say the wiki is already current.
10. Delete `_plan.md`, then rewrite `<wiki-root>/claude-wiki.json` with the current HEAD and timestamp (even after a no-op, so future runs skip the same range).
11. Final response: summarize which pages changed and why, or state that the wiki was already current.
