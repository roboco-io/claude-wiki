#!/usr/bin/env node
/**
 * Link-integrity checker for Claude Wiki output.
 * - [[wiki-link]] targets must exist as <name>.md somewhere in the wiki dir.
 * - Relative markdown links (./foo.md, sub/dir/page.md) must resolve.
 * - llm-wiki format (index.md present): every page must be reachable
 *   from index.md links ([[name]] or markdown links).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * Strip fenced code blocks and inline code spans so link patterns mentioned
 * as prose examples (e.g. `[[wiki-link]]` inside backticks) aren't treated
 * as real links. Replaces stripped regions with spaces to preserve offsets.
 */
function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length))
    .replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
}

function mdFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...mdFiles(path));
    else if (entry.endsWith(".md")) out.push(path);
  }
  return out;
}

export function checkWiki(root) {
  const errors = [];
  const pages = mdFiles(root);
  const slugs = new Map(pages.map((p) => [basename(p, ".md"), p]));

  for (const page of pages) {
    const text = stripCode(readFileSync(page, "utf8"));

    for (const [, slug] of text.matchAll(/\[\[([^\]|#]+?)(?:[|#][^\]]*)?\]\]/g)) {
      if (!slugs.has(slug.trim())) {
        errors.push(`BROKEN ${page}: [[${slug.trim()}]] has no ${slug.trim()}.md`);
      }
    }

    for (const [, target] of text.matchAll(/\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:\/\//.test(target)) continue; // external URL
      if (!existsSync(resolve(dirname(page), target))) {
        errors.push(`BROKEN ${page}: link target ${target} does not exist`);
      }
    }
  }

  const index = join(root, "index.md");
  if (existsSync(index)) {
    const text = stripCode(readFileSync(index, "utf8"));
    for (const [slug, path] of slugs) {
      if (slug === "index") continue;
      const linked =
        text.includes(`[[${slug}]]`) ||
        text.includes(`[[${slug}|`) ||
        text.includes(`${slug}.md`);
      if (!linked) errors.push(`ORPHAN ${path}: not linked from index.md`);
    }
  }

  return errors;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]).endsWith("check-links.mjs");
if (invokedDirectly) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: check-links.mjs <wiki-dir>");
    process.exit(2);
  }
  const errors = checkWiki(dir);
  for (const e of errors) console.error(e);
  console.log(errors.length === 0 ? "OK" : `${errors.length} problem(s)`);
  process.exit(errors.length === 0 ? 0 : 1);
}
