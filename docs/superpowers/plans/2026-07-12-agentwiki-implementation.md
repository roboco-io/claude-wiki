# AgentWiki Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working AgentWiki v0.1: a Claude Code plugin (`/agentwiki:init`, `/agentwiki:update`) plus a thin `agentwiki` CLI that drives `claude -p` headlessly — subscription-only, no API key.

**Architecture:** All wiki-generation intelligence lives in `skills/wiki-generation/SKILL.md` (single source of truth). Commands are thin wrappers that parse args and delegate to the skill. The CLI reads the skill markdown at runtime, strips frontmatter, inlines it into the `-p` prompt, and spawns the user's local `claude` binary. **Verified constraint (2026-07-12, official headless docs):** plugin slash commands cannot be invoked in `claude -p` headless mode, so prompt-inlining is the primary design, not a fallback.

**Tech Stack:** Markdown prompts (plugin), TypeScript ESM / Node >= 20 (CLI, zero runtime deps), vitest.

## Global Constraints

- **No API key, ever.** All LLM execution goes through the user's `claude` CLI (subscription or `CLAUDE_CODE_OAUTH_TOKEN` in CI). Never call the Anthropic API or Agent SDK.
- **Zero runtime dependencies** in the CLI: `node:child_process`, `node:fs`, `node:path`, `node:url` only.
- **No wiki-generation logic in TypeScript.** The CLI parses args, checks preconditions, builds the prompt from the skill file, spawns `claude`, streams output.
- Node >= 20, ESM (`"type": "module"`), TypeScript strict (existing tsconfig).
- Output formats: `llm-wiki` (default) and `openwiki`. Metadata file is `agentwiki.json` at the wiki root: `{"version": 1, "format": "...", "lastRunCommit": "<sha>", "lastRunAt": "<ISO-8601>"}`.
- **Do NOT port** OpenWiki's connector/personal-mode instructions (scoped out).
- Headless flags (verified against headless.md): `--permission-mode acceptEdits`, `--allowedTools "Read,Glob,Grep,Write,Edit,Bash(git:*),Bash(rg:*),Bash(date:*)"`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Working directory: `/Users/dohyunjung/Workspace/opensource/agentwiki` (branch `main`).

---

### Task 1: `skills/wiki-generation/SKILL.md` — core generation workflow

The heart of the project. Ports OpenWiki's run discipline (`openwiki/src/agent/prompt.ts`, code mode only) into Claude Code skill form. All init/update logic — including preconditions and metadata read/write — lives here so both the interactive commands and the headless CLI share one source.

**Files:**
- Modify: `skills/wiki-generation/SKILL.md` (replace TODO stub entirely)

**Interfaces:**
- Consumes: nothing (root task).
- Produces: the skill body that Task 2/3 commands delegate to and Task 5's `buildPrompt()` inlines. The frontmatter delimiter contract matters: the file starts with `---\n` and the frontmatter ends with the second `---\n`; `buildPrompt()` strips everything up to and including the second `---` line.

- [ ] **Step 1: Write the full skill body**

Replace the entire file with:

````markdown
---
name: wiki-generation
description: Analyze a repository and generate or incrementally update an agent-friendly wiki. Used by /agentwiki:init and /agentwiki:update, or when the user asks to generate/refresh codebase documentation as a wiki.
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
| Metadata | `wiki/agentwiki.json` | `openwiki/agentwiki.json` |

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

## Mode: init

1. Preconditions: confirm the working directory is a git repository (`git rev-parse --is-inside-work-tree`). If `<wiki-root>/agentwiki.json` already exists, stop and tell the user to run `/agentwiki:update` instead (or delete the wiki root to force a rebuild).
2. Build a repository inventory first: existing docs, entrypoints, package/config files, major domain folders, tests, data/schema files, operational scripts.
3. Use git evidence to understand how important files and workflows came to be (recent commits, targeted blame/show on high-signal files).
4. If the repository already has substantial docs, make the wiki an opinionated map and synthesis layer over them.
5. Write the entry page first, then the linked section/topic pages. Use at most 8 pages unless the repository is clearly tiny (then use fewer).
6. Do not try to document every source file. Cover the main architecture, workflows, domain concepts, data models, integrations, operations, tests, and extension points.
7. Delete `_plan.md`, then write `<wiki-root>/agentwiki.json`:

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

1. Read `<wiki-root>/agentwiki.json`. Check `wiki/` first, then `openwiki/`; the metadata's `format` field wins over the directory name. **If no metadata file exists in either location, fall back to full init behavior** (using the existing wiki directory's format if one exists, else `llm-wiki`) and say you are doing so.
2. Scope the update: run `git diff --name-only <lastRunCommit>..HEAD` plus `git status --porcelain` for uncommitted changes. If `lastRunCommit` is unknown to git (e.g. shallow clone or history rewrite), say so and scope from the most recent ~20 commits instead.
3. Build a docs impact plan in `_plan.md` before editing: source change → affected page → edit needed → why. If a page cannot be tied to a relevant change, do not edit it.
4. Update runs are surgical. Preserve accurate structure and wording; prefer replacing one stale sentence over adding paragraphs. Only edit pages made inaccurate, incomplete, or misleading by the changes.
5. No formatting-only edits: do not reformat tables, normalize whitespace, reorder lists, or polish wording unless the surrounding content is already being corrected.
6. Soft diff budget: if fewer than ~5 source files changed, edit at most 1-2 pages. Avoid touching the entry page unless top-level behavior, setup, or navigation changed. If you believe more than 3 pages need edits, re-examine the impact plan before proceeding.
7. Add missing pages or remove obsolete claims only when the impact plan demands it; keep entry-page links accurate.
8. **Updates may be a no-op.** If nothing relevant changed and the wiki is accurate, edit nothing and say the wiki is already current.
9. Delete `_plan.md`, then rewrite `<wiki-root>/agentwiki.json` with the current HEAD and timestamp (even after a no-op, so future runs skip the same range).
10. Final response: summarize which pages changed and why, or state that the wiki was already current.
````

- [ ] **Step 2: Self-review against the port checklist**

Verify each item exists in the file (grep or eyeball):
- targeted discovery / no `**/*` globs / `rg --files` excludes
- evidence-grounding ("never invent")
- init: entry page + minimal pages, ≤ 8 page cap, metadata precondition stop
- update: metadata fallback to init, diff scoping, impact plan, surgical edits, no-op allowed, soft diff budget
- both format specs with exact paths (`wiki/index.md`, `openwiki/quickstart.md`, `agentwiki.json`)
- NO connector/personal/OpenWiki-CLI content anywhere (grep for `connector`, `openwiki_`, `~/.openwiki` — must all be absent)

Run: `grep -icE 'connector|openwiki_ingest|\.openwiki' skills/wiki-generation/SKILL.md`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add skills/wiki-generation/SKILL.md
git commit -m "feat: write wiki-generation skill body (ported from openwiki run discipline)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `commands/init.md` — thin init wrapper

**Files:**
- Modify: `commands/init.md` (replace TODO stub)

**Interfaces:**
- Consumes: the `wiki-generation` skill from Task 1 (delegates by name; the skill owns preconditions and metadata).
- Produces: the `/agentwiki:init` command surface. `$ARGUMENTS` may contain `--format llm-wiki|openwiki`.

- [ ] **Step 1: Write the command body**

Replace the file with:

````markdown
---
description: Generate the initial agent-friendly wiki for this repository
argument-hint: "[--format llm-wiki|openwiki]"
---

# /agentwiki:init

Generate the initial wiki for the current repository.

Arguments: `$ARGUMENTS`

1. Determine the output format from the arguments above: `--format openwiki` selects `openwiki`; `--format llm-wiki` or no format flag selects `llm-wiki` (the default). Any other `--format` value: stop and report that valid values are `llm-wiki` and `openwiki`.
2. Load and follow the `wiki-generation` skill in **init** mode with the chosen format. The skill defines the entire workflow, including preconditions and writing the `agentwiki.json` metadata file — do not duplicate or skip any of its steps.
````

- [ ] **Step 2: Commit**

```bash
git add commands/init.md
git commit -m "feat: implement /agentwiki:init command as thin skill delegate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `commands/update.md` — thin update wrapper

**Files:**
- Modify: `commands/update.md` (replace TODO stub)

**Interfaces:**
- Consumes: the `wiki-generation` skill from Task 1.
- Produces: the `/agentwiki:update` command surface (no arguments).

- [ ] **Step 1: Write the command body**

Replace the file with:

````markdown
---
description: Incrementally refresh the agent-friendly wiki for this repository
---

# /agentwiki:update

Incrementally update the existing wiki based on changes since the last documented run.

Load and follow the `wiki-generation` skill in **update** mode. The skill defines the entire workflow: locating `agentwiki.json` (falling back to full init behavior when it is missing), diff-scoping the revision, editing surgically, and rewriting the metadata file. Do not duplicate or skip any of its steps. The format is whatever the metadata file records.
````

- [ ] **Step 2: Commit**

```bash
git add commands/update.md
git commit -m "feat: implement /agentwiki:update command as thin skill delegate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: CLI argument parsing (`src/args.ts`)

Pure, testable arg parsing — no I/O. TDD.

**Files:**
- Create: `src/args.ts`
- Test: `test/args.test.ts`
- Modify: `package.json` (nothing needed — `vitest` already configured via `npm test`)

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 5's `src/cli.ts`):
  ```ts
  export type Format = "llm-wiki" | "openwiki";
  export type ParsedArgs =
    | { kind: "init"; format: Format }
    | { kind: "update" }
    | { kind: "help" }
    | { kind: "error"; message: string };
  export function parseArgs(argv: string[]): ParsedArgs; // argv = process.argv.slice(2)
  ```

- [ ] **Step 1: Install dev deps (first run only) and write the failing test**

Run: `npm install` (installs the devDependencies already declared in package.json)

Create `test/args.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("defaults init to llm-wiki format", () => {
    expect(parseArgs(["init"])).toEqual({ kind: "init", format: "llm-wiki" });
  });

  it("accepts --format openwiki", () => {
    expect(parseArgs(["init", "--format", "openwiki"])).toEqual({
      kind: "init",
      format: "openwiki",
    });
  });

  it("accepts --format=llm-wiki syntax", () => {
    expect(parseArgs(["init", "--format=llm-wiki"])).toEqual({
      kind: "init",
      format: "llm-wiki",
    });
  });

  it("rejects unknown formats", () => {
    const result = parseArgs(["init", "--format", "confluence"]);
    expect(result.kind).toBe("error");
  });

  it("rejects --format without a value", () => {
    expect(parseArgs(["init", "--format"]).kind).toBe("error");
  });

  it("parses update with no options", () => {
    expect(parseArgs(["update"])).toEqual({ kind: "update" });
  });

  it("rejects update with --format", () => {
    expect(parseArgs(["update", "--format", "openwiki"]).kind).toBe("error");
  });

  it("returns help for no args, --help, and -h", () => {
    expect(parseArgs([])).toEqual({ kind: "help" });
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  it("rejects unknown commands", () => {
    expect(parseArgs(["deploy"]).kind).toBe("error");
  });

  it("rejects unknown flags", () => {
    expect(parseArgs(["init", "--fast"]).kind).toBe("error");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/args.test.ts`
Expected: FAIL — cannot find module `../src/args.js`

- [ ] **Step 3: Implement `src/args.ts`**

```ts
export type Format = "llm-wiki" | "openwiki";

export type ParsedArgs =
  | { kind: "init"; format: Format }
  | { kind: "update" }
  | { kind: "help" }
  | { kind: "error"; message: string };

const FORMATS: readonly Format[] = ["llm-wiki", "openwiki"];

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;

  if (command === undefined || command === "--help" || command === "-h") {
    return { kind: "help" };
  }

  if (command === "init") {
    let format: Format = "llm-wiki";
    for (let i = 0; i < rest.length; i++) {
      const arg = rest[i];
      let value: string | undefined;
      if (arg === "--format") {
        value = rest[++i];
      } else if (arg.startsWith("--format=")) {
        value = arg.slice("--format=".length);
      } else {
        return { kind: "error", message: `unknown option for init: ${arg}` };
      }
      if (value === undefined || !FORMATS.includes(value as Format)) {
        return {
          kind: "error",
          message: `--format must be one of: ${FORMATS.join(", ")}`,
        };
      }
      format = value as Format;
    }
    return { kind: "init", format };
  }

  if (command === "update") {
    if (rest.length > 0) {
      return { kind: "error", message: `update takes no options: ${rest[0]}` };
    }
    return { kind: "update" };
  }

  return { kind: "error", message: `unknown command: ${command}` };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/args.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/args.ts test/args.test.ts package-lock.json
git commit -m "feat: CLI argument parsing with format validation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Headless runner (`src/headless.ts`) and CLI entry (`src/cli.ts`)

Builds the `-p` prompt by inlining the skill body, detects the `claude` binary, spawns it with verified flags, and wires up the entrypoint.

**Files:**
- Create: `src/headless.ts`
- Modify: `src/cli.ts` (replace stub)
- Test: `test/headless.test.ts`

**Interfaces:**
- Consumes: `parseArgs`, `Format`, `ParsedArgs` from Task 4; `skills/wiki-generation/SKILL.md` from Task 1 (frontmatter contract: strip through the second `---` line).
- Produces:
  ```ts
  // src/headless.ts
  export function packageRoot(): string;                      // repo/package root (parent of dist/ or src/)
  export function buildPrompt(kind: "init" | "update", format?: Format): string;
  export function findClaude(): string | null;                // resolved binary name or null
  export function runHeadless(kind: "init" | "update", format?: Format): Promise<number>; // exit code
  ```

- [ ] **Step 1: Write the failing tests**

Create `test/headless.test.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPrompt, packageRoot } from "../src/headless.js";

describe("packageRoot", () => {
  it("resolves to the directory containing the skill file", () => {
    const skill = join(packageRoot(), "skills", "wiki-generation", "SKILL.md");
    expect(existsSync(skill)).toBe(true);
  });
});

describe("buildPrompt", () => {
  it("strips the YAML frontmatter", () => {
    const prompt = buildPrompt("init", "llm-wiki");
    expect(prompt).not.toContain("name: wiki-generation");
    expect(prompt).toContain("# Wiki Generation");
  });

  it("appends an init-mode instruction with the format", () => {
    const prompt = buildPrompt("init", "openwiki");
    expect(prompt).toMatch(/init.*mode/i);
    expect(prompt).toContain("openwiki");
  });

  it("appends an update-mode instruction without requiring a format", () => {
    const prompt = buildPrompt("update");
    expect(prompt).toMatch(/update.*mode/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/headless.test.ts`
Expected: FAIL — cannot find module `../src/headless.js`

- [ ] **Step 3: Implement `src/headless.ts`**

```ts
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Format } from "./args.js";

const ALLOWED_TOOLS =
  "Read,Glob,Grep,Write,Edit,Bash(git:*),Bash(rg:*),Bash(date:*)";

/** Package root = parent of the directory holding this module (src/ or dist/). */
export function packageRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function skillBody(): string {
  const path = join(packageRoot(), "skills", "wiki-generation", "SKILL.md");
  const raw = readFileSync(path, "utf8");
  // Strip YAML frontmatter: drop everything through the closing --- line.
  const closing = raw.indexOf("\n---", raw.indexOf("---"));
  return closing === -1 ? raw : raw.slice(raw.indexOf("\n", closing + 1) + 1);
}

export function buildPrompt(kind: "init" | "update", format?: Format): string {
  const instruction =
    kind === "init"
      ? `Run the workflow above now in init mode with format "${format ?? "llm-wiki"}" for the current repository.`
      : "Run the workflow above now in update mode for the current repository.";
  return `${skillBody().trim()}\n\n---\n\n${instruction}`;
}

export function findClaude(): string | null {
  const probe = spawnSync("claude", ["--version"], { stdio: "ignore" });
  return probe.error ? null : "claude";
}

export function runHeadless(
  kind: "init" | "update",
  format?: Format,
): Promise<number> {
  const claude = findClaude();
  if (claude === null) {
    console.error(
      "agentwiki: `claude` CLI not found.\n" +
        "Install Claude Code (https://code.claude.com) and log in, or in CI set CLAUDE_CODE_OAUTH_TOKEN.",
    );
    return Promise.resolve(1);
  }

  const child = spawn(
    claude,
    [
      "-p",
      buildPrompt(kind, format),
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      ALLOWED_TOOLS,
    ],
    { stdio: "inherit" },
  );

  return new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/headless.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Rewrite `src/cli.ts` to wire everything together**

Replace the stub body (keep the shebang and header comment):

```ts
#!/usr/bin/env node
/**
 * agentwiki CLI — thin wrapper that drives the locally installed Claude Code
 * CLI (`claude -p`) in headless mode. All wiki-generation logic lives in the
 * plugin's skill markdown so it runs under the user's Claude subscription;
 * this wrapper only handles argument parsing and process orchestration.
 */
import { parseArgs } from "./args.js";
import { runHeadless } from "./headless.js";

const HELP = `agentwiki — agent-friendly codebase wikis via Claude Code

Usage:
  agentwiki init [--format llm-wiki|openwiki]   Generate the initial wiki
  agentwiki update                              Incrementally refresh the wiki
  agentwiki --help                              Show this help
`;

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  switch (parsed.kind) {
    case "help":
      console.log(HELP);
      break;
    case "error":
      console.error(`agentwiki: ${parsed.message}`);
      console.error(HELP);
      process.exit(2);
      break;
    case "init":
      process.exit(await runHeadless("init", parsed.format));
      break;
    case "update":
      process.exit(await runHeadless("update"));
      break;
  }
}

await main();
```

- [ ] **Step 6: Full verification — tests, typecheck, build, smoke**

```bash
npx vitest run
npm run typecheck
npm run build
node dist/cli.js --help
node dist/cli.js init --format confluence; echo "exit: $?"
```

Expected: tests PASS; typecheck and build clean; `--help` prints usage; invalid format prints the error + usage and `exit: 2`.
Also verify the built layout resolves the skill: `node -e "import('./dist/headless.js').then(m => console.log(m.buildPrompt('update').slice(0, 60)))"` prints the start of the skill body (proves `dist/../skills/` resolution works — same relative depth as `src/`).

- [ ] **Step 7: Commit**

```bash
git add src/headless.ts src/cli.ts test/headless.test.ts
git commit -m "feat: headless CLI — inline skill prompt into claude -p

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Link-integrity checker (`scripts/check-links.mjs`)

Plain-Node validation of generated wikis — no LLM, zero deps. Used after E2E runs and available to users/CI.

**Files:**
- Create: `scripts/check-links.mjs`
- Test: `test/check-links.test.ts`
- Modify: `package.json` (add script `"check-links": "node scripts/check-links.mjs"`)

**Interfaces:**
- Consumes: a wiki directory produced per Task 1's format specs.
- Produces: `node scripts/check-links.mjs <wiki-dir>` — exit 0 when clean, exit 1 with one `BROKEN`/`ORPHAN` line per problem. Exports `checkWiki(dir): string[]` for tests.

- [ ] **Step 1: Write the failing test**

Create `test/check-links.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain-JS script module without type declarations
import { checkWiki } from "../scripts/check-links.mjs";

function makeWiki(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "agentwiki-test-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("checkWiki (llm-wiki format)", () => {
  it("passes a consistent wiki", () => {
    const dir = makeWiki({
      "index.md": "# Index\n- [[setup]]",
      "setup.md": "# Setup\nback to [[index]]",
    });
    expect(checkWiki(dir)).toEqual([]);
  });

  it("flags [[links]] to missing pages", () => {
    const dir = makeWiki({ "index.md": "see [[missing-page]]" });
    expect(checkWiki(dir).some((e) => e.includes("missing-page"))).toBe(true);
  });

  it("flags pages not linked from index.md", () => {
    const dir = makeWiki({
      "index.md": "# Index (links nothing)",
      "orphan.md": "# Orphan",
    });
    expect(checkWiki(dir).some((e) => e.includes("orphan"))).toBe(true);
  });
});

describe("checkWiki (openwiki format)", () => {
  it("flags broken relative markdown links", () => {
    const dir = makeWiki({
      "quickstart.md": "see [arch](architecture/overview.md)",
    });
    expect(checkWiki(dir).some((e) => e.includes("architecture/overview.md"))).toBe(true);
  });

  it("passes when relative links resolve", () => {
    const dir = makeWiki({
      "quickstart.md": "see [arch](architecture/overview.md)",
      "architecture/overview.md": "# Overview\nback to [qs](../quickstart.md)",
    });
    expect(checkWiki(dir)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/check-links.test.ts`
Expected: FAIL — cannot find module `../scripts/check-links.mjs`

- [ ] **Step 3: Implement `scripts/check-links.mjs`**

```js
#!/usr/bin/env node
/**
 * Link-integrity checker for AgentWiki output.
 * - [[wiki-link]] targets must exist as <name>.md somewhere in the wiki dir.
 * - Relative markdown links (./foo.md, sub/dir/page.md) must resolve.
 * - llm-wiki format (index.md present): every page must be reachable
 *   from index.md links ([[name]] or markdown links).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function mdFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...mdFiles(path));
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
}

export function checkWiki(root) {
  const errors = [];
  const pages = mdFiles(root);
  const slugs = new Map(pages.map((p) => [basename(p, ".md"), p]));

  for (const page of pages) {
    const text = readFileSync(page, "utf8");

    for (const [, slug] of text.matchAll(/\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g)) {
      if (!slugs.has(slug.trim())) {
        errors.push(`BROKEN ${page}: [[${slug.trim()}]] has no ${slug.trim()}.md`);
      }
    }

    for (const [, target] of text.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:\/\//.test(target)) continue; // external URL
      if (!existsSync(resolve(dirname(page), target))) {
        errors.push(`BROKEN ${page}: link target ${target} does not exist`);
      }
    }
  }

  const index = join(root, "index.md");
  if (existsSync(index)) {
    const text = readFileSync(index, "utf8");
    for (const [slug, path] of slugs) {
      if (slug === "index") continue;
      const linked =
        text.includes(`[[${slug}]]`) ||
        text.includes(`[[${slug}|`) ||
        text.includes(`${slug}.md`);
      if (!linked) errors.push(`ORPHAN ${path}: not linked from index.md`);
    }
  }

  return errors;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]).endsWith("check-links.mjs");
if (invokedDirectly) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: check-links.mjs <wiki-dir>");
    process.exit(2);
  }
  const errors = checkWiki(dir);
  for (const e of errors) console.error(e);
  console.log(errors.length === 0 ? "OK" : `${errors.length} problem(s)`);
  process.exit(errors.length === 0 ? 0 : 1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/check-links.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Add the npm script and commit**

In `package.json` scripts, add: `"check-links": "node scripts/check-links.mjs"`.

```bash
npx vitest run
git add scripts/check-links.mjs test/check-links.test.ts package.json
git commit -m "feat: link-integrity checker for generated wikis

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: E2E verification and README

Run the real flows (interactive plugin + headless CLI, both formats) against this repository itself, then document usage.

**Files:**
- Modify: `README.md` (usage section)
- Modify: `HANDOFF.md` (mark completed items)

**Interfaces:**
- Consumes: everything above.
- Produces: verified v0.1 plus user-facing docs.

- [ ] **Step 1: Headless E2E — llm-wiki format on this repo**

```bash
cd /Users/dohyunjung/Workspace/opensource/agentwiki
npm run build
node dist/cli.js init
```

Expected: `claude -p` runs, creates `wiki/index.md` (+ ≤ 8 pages) and `wiki/agentwiki.json` with `"format": "llm-wiki"` and the current HEAD sha.
Then: `node scripts/check-links.mjs wiki` → `OK`.

- [ ] **Step 2: Headless E2E — update no-op and openwiki format**

```bash
node dist/cli.js update     # no source changes → expect "already current", metadata timestamp refreshed
rm -rf wiki
node dist/cli.js init --format openwiki
node scripts/check-links.mjs openwiki
```

Expected: update reports no-op; openwiki run creates `openwiki/quickstart.md` + section dirs + `openwiki/agentwiki.json`; link check `OK`.
Cleanup: `rm -rf openwiki` (keep the repo clean; wiki output is a product of user repos, not this one). If a format's output looks wrong, fix SKILL.md wording — not the CLI — and re-run.

- [ ] **Step 3: Interactive plugin E2E**

Manual step (needs an interactive session — ask the user to run it, or use a fresh `claude` session in a scratch clone):

```
claude --plugin-dir /Users/dohyunjung/Workspace/opensource/agentwiki
> /agentwiki:init
```

Expected: command appears in the slash menu, generates `wiki/` identically to the headless run. Record any deviation in HANDOFF.md.

- [ ] **Step 4: Update README usage section**

Add to `README.md`: install (`npm i -g agentwiki` + plugin install), the two commands with `--format`, headless/CI usage referencing `examples/agentwiki-update.yml` and `claude setup-token`, the `agentwiki.json` metadata contract, and the no-API-key design in one sentence.

- [ ] **Step 5: Update HANDOFF.md and commit**

Mark the completed Next Steps items, set In Progress to "npm publish + marketplace registration remain (user account required)".

```bash
npx vitest run && npm run typecheck
git add README.md HANDOFF.md
git commit -m "docs: usage README and handoff refresh after v0.1 implementation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

---

## Out of scope for this plan (user-driven follow-ups)

- npm publish (`npm publish` needs the user's npm account) and roboco-io marketplace registration.
- stream-json progress rendering in the CLI (V1 uses `stdio: inherit` with claude's default text output).
- `--plugin-dir`-based headless invocation (V1 inlines the skill; revisit if prompt-size limits bite).
