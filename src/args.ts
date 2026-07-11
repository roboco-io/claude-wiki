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
