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
