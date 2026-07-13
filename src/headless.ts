import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Format } from "./args.js";

const ALLOWED_TOOLS =
  "Read,Glob,Grep,Write,Edit,Task,Bash(git:*),Bash(rg:*),Bash(rm:*),Bash(date:*)";

/** Package root = parent of the directory holding this module (src/ or dist/). */
export function packageRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function skillBody(): string {
  const path = join(packageRoot(), "skills", "wiki-generation", "SKILL.md");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`claude-wiki: could not read skill file at ${path}: ${err}`, {
      cause: err,
    });
  }
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
      "claude-wiki: `claude` CLI not found.\n" +
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
    child.on("error", (err) => {
      console.error(`claude-wiki: failed to launch \`claude\`: ${err.message}`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}
