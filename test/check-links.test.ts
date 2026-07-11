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
