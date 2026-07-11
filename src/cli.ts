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
      process.exit(await runOrExit("init", parsed.format));
      break;
    case "update":
      process.exit(await runOrExit("update"));
      break;
  }
}

async function runOrExit(
  kind: "init" | "update",
  format?: Parameters<typeof runHeadless>[1],
): Promise<number> {
  try {
    return await runHeadless(kind, format);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

await main();
