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
