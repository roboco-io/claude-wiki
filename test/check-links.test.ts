import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain-JS script module without type declarations
import { checkWiki } from "../scripts/check-links.mjs";

function makeWiki(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "claude-wiki-test-"));
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

  it("does not flag [[wiki-link]] syntax mentioned in an inline code span", () => {
    const dir = makeWiki({
      "index.md":
        "# Index\nThe llm-wiki format uses `[[not-a-real-page]]` syntax for cross-links.",
    });
    expect(checkWiki(dir).some((e) => e.includes("BROKEN"))).toBe(false);
  });

  it("does not flag [[links]] or ](target.md) inside a fenced code block", () => {
    const dir = makeWiki({
      "index.md":
        "# Index\n\n```\nExample: [[also-fake]] and [link](fake/path.md)\n```\n",
    });
    expect(checkWiki(dir).some((e) => e.includes("BROKEN"))).toBe(false);
  });

  it("still flags a real [[missing-page]] link outside of code", () => {
    const dir = makeWiki({
      "index.md": "# Index\nSee [[missing-page]] for details.",
    });
    expect(checkWiki(dir).some((e) => e.includes("BROKEN") && e.includes("missing-page"))).toBe(
      true,
    );
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
