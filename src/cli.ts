#!/usr/bin/env node
/**
 * agentwiki CLI — thin wrapper that drives the locally installed Claude Code
 * CLI (`claude -p`) in headless mode. All wiki-generation logic lives in the
 * plugin's commands and skills so it runs under the user's Claude
 * subscription; this wrapper only handles argument parsing and process
 * orchestration.
 */

const HELP = `agentwiki — agent-friendly codebase wikis via Claude Code

Usage:
  agentwiki init [--format llm-wiki|openwiki]   Generate the initial wiki
  agentwiki update                              Incrementally refresh the wiki
  agentwiki --help                              Show this help
`;

function main(): void {
  const [command] = process.argv.slice(2);

  switch (command) {
    case "init":
    case "update":
      // TODO(implementation): spawn `claude -p` with the corresponding
      // plugin command and stream output.
      console.error(`agentwiki ${command}: not implemented yet`);
      process.exit(1);
      break;
    default:
      console.log(HELP);
  }
}

main();
