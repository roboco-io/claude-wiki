# Dev Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CI (GitHub Actions), a working eslint gate, a local-only E2E harness script, and a project verify skill to claude-wiki.

**Architecture:** Four independent additions per the approved spec (`docs/superpowers/specs/2026-07-13-dev-harness-design.md`). The E2E harness is a plain Node script following the existing `scripts/check-links.mjs` idiom (exported nothing, CLI + exit codes); CI runs only the fast gate — E2E stays local because it spends real Claude subscription tokens.

**Tech Stack:** GitHub Actions, eslint 9 + typescript-eslint 8 (flat config), Node 20 built-ins only for scripts.

## Global Constraints

- No Anthropic API / Agent SDK usage anywhere (project hard constraint).
- Zero **runtime** dependencies; eslint/typescript-eslint go in `devDependencies` only.
- Node >= 20, ESM.
- E2E must never run in CI or in `npm test`.
- `examples/claude-wiki-update.yml` is a user-facing template — do not modify.

---

### Task 1: Working eslint gate

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (devDependencies only; `lint` script already exists)
- Modify: `CLAUDE.md` (remove the stale "eslint is not installed" caveat)
- Modify: `wiki/development.md` (same stale claim)

**Interfaces:**
- Produces: `npm run lint` exits 0 on the clean tree. Task 3's CI workflow calls it.

- [ ] **Step 1: Install eslint + typescript-eslint**

```bash
npm install --save-dev eslint @eslint/js typescript-eslint
```

Expected: package.json devDependencies gains the three entries; no `dependencies` section appears.

- [ ] **Step 2: Write flat config**

Create `eslint.config.mjs`:

```js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "wiki/", "openwiki/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);
```

- [ ] **Step 3: Run lint, verify it actually lints**

```bash
npm run lint
```

Expected: exit 0. If it reports findings in existing `src/`, `test/`, or `scripts/` code, fix each finding minimally (do not disable rules file-wide; a targeted `// eslint-disable-next-line <rule>` with a reason is acceptable only if a fix would change behavior). Re-run until exit 0.

Sanity check that the gate is real — introduce a deliberate error and confirm it fails:

```bash
echo "const unused = 1;" >> src/args.ts && npm run lint; git checkout src/args.ts
```

Expected: lint FAILS with `@typescript-eslint/no-unused-vars` before the checkout restores the file.

- [ ] **Step 4: Update stale docs**

In `CLAUDE.md`, replace the sentence

> `npm run lint` is declared but eslint is not installed; the real gate is build + typecheck + test.

with:

> The full gate is build + typecheck + lint + test.

In `wiki/development.md`, replace the note

> Note: `package.json` declares `npm run lint` → `eslint .`, but eslint is not in devDependencies and no eslint config exists in the repo — treat build + typecheck + test as the real gate.

with:

> Lint uses eslint 9 + typescript-eslint flat config (`eslint.config.mjs`); the full gate is build + typecheck + lint + test.

Also add `npm run lint` to the command list in `wiki/development.md` if absent.

- [ ] **Step 5: Full gate + commit**

```bash
npm run build && npm run typecheck && npm run lint && npm test
git add eslint.config.mjs package.json package-lock.json CLAUDE.md wiki/development.md
git commit -m "chore: install eslint + typescript-eslint flat config"
```

Expected: all four commands pass; commit succeeds.

---

### Task 2: Local E2E harness (`scripts/e2e.mjs`)

**Files:**
- Create: `scripts/e2e.mjs`
- Modify: `package.json` (add `"test:e2e": "node scripts/e2e.mjs"` to scripts)

**Interfaces:**
- Consumes: `dist/cli.js` (built CLI), `scripts/check-links.mjs` (exports `checkWiki(root)`).
- Produces: `npm run test:e2e` — exit 0 all-pass / 1 any-fail / 2 precondition missing. Task 4's verify skill references this command.

- [ ] **Step 1: Write the script**

Create `scripts/e2e.mjs`:

```js
#!/usr/bin/env node
/**
 * Local-only E2E harness for claude-wiki.
 * Runs the built CLI (dist/cli.js) against temp fixture repos and verifies
 * the generated wikis. Each scenario spawns a real `claude -p` run — this
 * spends Claude subscription tokens and takes minutes. Never run in CI.
 *
 * Preconditions: `npm run build` done, `claude` CLI installed & logged in.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkWiki } from "./check-links.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "dist", "cli.js");

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

function git(cwd, ...args) {
  const r = spawnSync(
    "git",
    ["-c", "user.email=e2e@example.com", "-c", "user.name=e2e", ...args],
    { cwd, encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), "claude-wiki-e2e-"));
  writeFileSync(
    join(dir, "README.md"),
    "# greet-cli\n\nTiny Node CLI that prints a greeting.\n",
  );
  mkdirSync(join(dir, "src"));
  writeFileSync(
    join(dir, "src", "greet.js"),
    "export function greet(name) {\n  return `Hello, ${name}!`;\n}\n",
  );
  writeFileSync(
    join(dir, "src", "cli.js"),
    'import { greet } from "./greet.js";\nconsole.log(greet(process.argv[2] ?? "world"));\n',
  );
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      { name: "greet-cli", type: "module", bin: { greet: "src/cli.js" } },
      null,
      2,
    ) + "\n",
  );
  git(dir, "init");
  git(dir, "add", "-A");
  git(dir, "commit", "-m", "fixture", "--no-gpg-sign");
  return dir;
}

function runCli(cwd, ...args) {
  return spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8", stdio: "inherit" });
}

/** Map of relative .md path → content, for byte-identical comparison. */
function snapshotMd(dir, base = dir, out = new Map()) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) snapshotMd(path, base, out);
    else if (entry.endsWith(".md")) out.set(path.slice(base.length), readFileSync(path, "utf8"));
  }
  return out;
}

// --- Preconditions -----------------------------------------------------
if (!existsSync(CLI)) {
  console.error("e2e: dist/cli.js not found — run `npm run build` first.");
  process.exit(2);
}
if (spawnSync("claude", ["--version"], { stdio: "ignore" }).error) {
  console.error("e2e: `claude` CLI not found — install Claude Code and log in.");
  process.exit(2);
}

const cleanups = [];
try {
  // --- Scenario 1: init (llm-wiki) + no-op update ----------------------
  const fx1 = makeFixture();
  cleanups.push(fx1);
  const head1 = git(fx1, "rev-parse", "HEAD");
  const greetBefore = readFileSync(join(fx1, "src", "greet.js"), "utf8");

  console.log("\n=== scenario 1: init (llm-wiki) ===");
  const init1 = runCli(fx1, "init");
  check("init exits 0", init1.status === 0, `exit ${init1.status}`);
  check("wiki/index.md exists", existsSync(join(fx1, "wiki", "index.md")));
  check("_plan.md removed", !existsSync(join(fx1, "wiki", "_plan.md")));

  const metaPath = join(fx1, "wiki", "claude-wiki.json");
  check("claude-wiki.json exists", existsSync(metaPath));
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    check("meta.version === 1", meta.version === 1, String(meta.version));
    check('meta.format === "llm-wiki"', meta.format === "llm-wiki", meta.format);
    check("meta.lastRunCommit === fixture HEAD", meta.lastRunCommit === head1, meta.lastRunCommit);
  }
  const linkErrors = existsSync(join(fx1, "wiki")) ? checkWiki(join(fx1, "wiki")) : ["no wiki dir"];
  check("check-links OK", linkErrors.length === 0, linkErrors.join("; "));
  check(
    "fixture source untouched",
    readFileSync(join(fx1, "src", "greet.js"), "utf8") === greetBefore,
  );

  console.log("\n=== scenario 2: update is a no-op ===");
  const before = snapshotMd(join(fx1, "wiki"));
  const upd = runCli(fx1, "update");
  check("update exits 0", upd.status === 0, `exit ${upd.status}`);
  const after = snapshotMd(join(fx1, "wiki"));
  let identical = before.size === after.size;
  for (const [path, content] of before) {
    if (after.get(path) !== content) identical = false;
  }
  check("wiki pages byte-identical after no-op update", identical);

  // --- Scenario 3: init --format openwiki ------------------------------
  console.log("\n=== scenario 3: init --format openwiki ===");
  const fx2 = makeFixture();
  cleanups.push(fx2);
  const init2 = runCli(fx2, "init", "--format", "openwiki");
  check("openwiki init exits 0", init2.status === 0, `exit ${init2.status}`);
  check("openwiki/quickstart.md exists", existsSync(join(fx2, "openwiki", "quickstart.md")));
  const meta2Path = join(fx2, "openwiki", "claude-wiki.json");
  check("openwiki claude-wiki.json exists", existsSync(meta2Path));
  if (existsSync(meta2Path)) {
    const meta2 = JSON.parse(readFileSync(meta2Path, "utf8"));
    check('meta.format === "openwiki"', meta2.format === "openwiki", meta2.format);
  }
} finally {
  for (const dir of cleanups) rmSync(dir, { recursive: true, force: true });
}

console.log(failures.length === 0 ? "\nE2E OK" : `\nE2E: ${failures.length} failure(s)`);
process.exit(failures.length === 0 ? 0 : 1);
```

- [ ] **Step 2: Wire the npm script**

In `package.json` `scripts`, add (alphabetical position, after `test`):

```json
"test:e2e": "node scripts/e2e.mjs"
```

- [ ] **Step 3: Verify precondition fast-fail (cheap, no LLM)**

```bash
mv dist dist.bak 2>/dev/null; npm run test:e2e; echo "exit=$?"; mv dist.bak dist 2>/dev/null || npm run build
```

Expected: prints `e2e: dist/cli.js not found — run \`npm run build\` first.` and `exit=2`.

- [ ] **Step 4: One full real run (spends tokens, ~5-10 min)**

```bash
npm run build && npm run test:e2e
```

Expected: every line `PASS …`, final line `E2E OK`, exit 0. If any FAIL, diagnose before proceeding — do not weaken an assertion to make it pass without understanding why (e.g. skill-driven output variance vs. a real regression).

- [ ] **Step 5: Lint + unit tests still pass, then commit**

```bash
npm run lint && npm test
git add scripts/e2e.mjs package.json
git commit -m "feat: local-only E2E harness (npm run test:e2e)"
```

---

### Task 3: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint` (Task 1). Runs the fast gate only — never `test:e2e`.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run check-links -- wiki
```

- [ ] **Step 2: Replicate the CI sequence locally**

```bash
npm ci && npm run build && npm run typecheck && npm run lint && npm test && npm run check-links -- wiki
```

Expected: all commands exit 0 (final output `OK` from check-links).

- [ ] **Step 3: Commit, push, watch the run**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: fast gate on push/PR (build, typecheck, lint, test, check-links)"
git push origin main
gh run watch --exit-status $(gh run list --workflow=ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: workflow concludes `success`. If it fails, read the failing step's log (`gh run view --log-failed`), fix, and push again.

---

### Task 4: Project verify skill

**Files:**
- Create: `.claude/skills/verify/SKILL.md`
- Modify: `CLAUDE.md` (one-line pointer in the Commands section)

**Interfaces:**
- Consumes: `npm run test:e2e` (Task 2), the fast-gate commands (Task 1).

- [ ] **Step 1: Write the skill**

Create `.claude/skills/verify/SKILL.md`:

````markdown
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
````

- [ ] **Step 2: Add the CLAUDE.md pointer**

In `CLAUDE.md`, at the end of the Commands section paragraph (after the E2E sentence), the Commands section should read — replace the existing "E2E is manual…" sentence with:

```markdown
npm run test:e2e     # local-only E2E (real claude -p runs — costs tokens; see .claude/skills/verify/SKILL.md)
```

added to the fenced command block, and replace the prose sentence

> E2E is manual: run `node dist/cli.js init` against a small repo, verify output with `check-links.mjs` (procedure in HANDOFF.md).

with:

> Verification procedure (fast gate vs. token-spending E2E gate) is codified in `.claude/skills/verify/SKILL.md`.

- [ ] **Step 3: Verify the skill file parses as a skill**

```bash
head -5 .claude/skills/verify/SKILL.md
```

Expected: frontmatter opens with `---` on line 1 and includes `name: verify`.

- [ ] **Step 4: Fast gate + commit**

```bash
npm run build && npm run typecheck && npm run lint && npm test && npm run check-links -- wiki
git add .claude/skills/verify/SKILL.md CLAUDE.md
git commit -m "chore: add project verify skill codifying the verification ladder"
git push origin main
```

Expected: gate passes, push succeeds, CI (from Task 3) goes green on the pushed commit.

---

## Post-plan note

`wiki/development.md` gains accuracy edits in Task 1 only. A broader wiki refresh (documenting the new harness pages-worth of content) is intentionally deferred to a later `/claude-wiki:update` run — the harness itself is the deliverable here.
