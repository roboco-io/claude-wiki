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
