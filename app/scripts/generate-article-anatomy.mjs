#!/usr/bin/env node
// Builds src/content/assets/data/article-anatomy.json from article.mdx and its
// chapters: one entry per word (kind + length), chapters, headings, component
// instances, citations and internal links. The banner embeds read this file.
//
// Usage: node scripts/generate-article-anatomy.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = resolve(root, "src/content");
const articlePath = resolve(contentDir, "article.mdx");
const outPath = resolve(contentDir, "assets/data/article-anatomy.json");

// Token kinds, one character each in the output `kinds` string
const KIND = {
  prose: "p",
  heading: "h",
  code: "c",
  math: "m",
  markup: "x",
  table: "t",
};

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~[\]()]/g, "")
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const stripFrontmatter = (src) => src.replace(/^---\n[\s\S]*?\n---\n/, "");

// Article body in render order: imported chapters (`import X from "./chapters/..."`
// + `<X />`) become chapters, inline content between them becomes its own chapter
function chapterSources() {
  const src = stripFrontmatter(readFileSync(articlePath, "utf8"));
  const imports = new Map();
  for (const m of src.matchAll(
    /^import\s+(\w+)\s+from\s+["'](.+?\.mdx)["'];?/gm,
  )) {
    imports.set(m[1], resolve(contentDir, m[2]));
  }
  const order = [];
  let loose = [];
  const flush = () => {
    if (loose.some((l) => !/^\s*(import|export)\s/.test(l) && words(l).length))
      order.push({ name: "Article", lines: loose });
    loose = [];
  };
  for (const line of src.split("\n")) {
    const m = line.trim().match(/^<(\w+)\s*\/>$/);
    if (m && imports.has(m[1])) {
      flush();
      order.push({
        name: m[1],
        lines: stripFrontmatter(readFileSync(imports.get(m[1]), "utf8")).split(
          "\n",
        ),
      });
    } else {
      loose.push(line);
    }
  }
  flush();
  return order;
}

const words = (text) =>
  text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => /[\p{L}\p{N}]/u.test(w));

function tokenize(chapterIndex, lines, out) {
  let inFence = false;
  let inMath = false;
  let inTag = 0; // nesting depth of a multi-line JSX opening tag
  let inComment = false;
  let title = null;

  const push = (w, kind) => {
    out.kinds.push(kind);
    out.lengths.push(
      Math.min(35, w.replace(/[^\p{L}\p{N}]/gu, "").length || 1),
    );
    out.chapterOf.push(chapterIndex);
  };
  const pushText = (text, kind) => {
    // Inline code and inline math keep their own kind inside prose lines
    const parts = text.split(/(`[^`]+`|\$[^$]+\$)/g);
    for (const part of parts) {
      if (!part) continue;
      const k = part.startsWith("`")
        ? KIND.code
        : part.startsWith("$")
          ? KIND.math
          : kind;
      const clean =
        k === kind
          ? part
              .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
              .replace(/<[^>]+>/g, " ")
          : part;
      for (const w of words(clean)) push(w, k);
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (/^(```|~~~)/.test(t)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      for (const w of words(line)) push(w, KIND.code);
      continue;
    }
    if (inComment || t.startsWith("{/*")) {
      inComment = !t.includes("*/}");
      continue;
    }
    if (t === "$$") {
      inMath = !inMath;
      continue;
    }
    if (inMath || /^\$\$.*\$\$$/.test(t)) {
      for (const w of words(t.replace(/\$\$/g, ""))) push(w, KIND.math);
      continue;
    }
    if (/^import\s|^export\s/.test(t)) continue;

    // Citations and internal links, anchored at the current token index
    for (const m of t.matchAll(/\[@([\w:-]+)/g))
      out.citations.push({ key: m[1], at: out.kinds.length });
    for (const m of t.matchAll(/\]\(#([^)]+)\)/g))
      out.links.push({ href: m[1], at: out.kinds.length });
    for (const m of t.matchAll(/\bid=["']([\w-]+)["']/g))
      out.anchors[m[1]] = out.kinds.length;

    const heading = t.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      const text = heading[2].replace(/\*\*/g, "").trim();
      const level = heading[1].length;
      if (
        !title ||
        (level === 2 &&
          !out.headings.some(
            (h) => h.chapter === chapterIndex && h.level === 2,
          ))
      )
        title = text;
      out.anchors[slugify(text)] = out.kinds.length;
      out.headings.push({
        level,
        title: text,
        chapter: chapterIndex,
        at: out.kinds.length,
      });
      pushText(text, KIND.heading);
      continue;
    }

    // JSX / HTML tags: attributes count as markup, children text as prose
    if (inTag || /^<\/?[A-Za-z]/.test(t)) {
      const open = t.match(/^<([A-Z]\w*)/);
      if (open) {
        const src = t.match(/\bsrc=["']([^"']+)["']/);
        out.components.push({
          type: open[1],
          at: out.kinds.length,
          src: src ? src[1] : undefined,
        });
      } else if (inTag) {
        const src = t.match(/\bsrc=["']([^"']+)["']/);
        const last = out.components[out.components.length - 1];
        if (src && last && !last.src) last.src = src[1];
      }
      const startsTag = /^<[A-Za-z]/.test(t) && !/>/.test(t);
      if (startsTag) inTag = 1;
      else if (inTag && />\s*$/.test(t)) inTag = 0;
      const inner = t.match(/^<[^>]+>(.*?)(<\/[^>]+>)?$/);
      if (!inTag && inner && inner[1]) pushText(inner[1], KIND.prose);
      for (const w of words(t.replace(/>.*$/, ""))) push(w, KIND.markup);
      continue;
    }
    if (/^\|/.test(t)) {
      if (!/^\|[\s|:-]+\|?$/.test(t))
        pushText(t.replace(/\|/g, " "), KIND.table);
      continue;
    }
    if (t) pushText(t.replace(/^([-*+]|\d+\.)\s+|^>\s?/, ""), KIND.prose);
  }
  return title;
}

function main() {
  const out = {
    kinds: [],
    lengths: [],
    chapterOf: [],
    headings: [],
    components: [],
    citations: [],
    links: [],
    anchors: {},
  };

  const chapters = chapterSources().map(({ name, lines }, i) => {
    const start = out.kinds.length;
    const title = tokenize(i, lines, out) || name;
    return { title, start, words: out.kinds.length - start };
  });

  const links = out.links
    .map((l) => ({ from: l.at, to: out.anchors[l.href] }))
    .filter((l) => Number.isFinite(l.to));

  const data = {
    generated: "node scripts/generate-article-anatomy.mjs",
    total: out.kinds.length,
    kindLegend: {
      p: "prose",
      h: "heading",
      c: "code",
      m: "math",
      x: "component markup",
      t: "table",
    },
    kinds: out.kinds.join(""),
    lengths: out.lengths.map((n) => n.toString(36)).join(""),
    chapters,
    headings: out.headings,
    components: out.components,
    citations: out.citations,
    links,
  };

  writeFileSync(outPath, JSON.stringify(data) + "\n");
  const counts = {};
  for (const k of out.kinds) counts[k] = (counts[k] || 0) + 1;
  console.log(
    `article-anatomy.json: ${data.total} tokens, ${chapters.length} chapters, ` +
      `${out.headings.length} headings, ${out.components.length} components, ` +
      `${out.citations.length} citations, ${links.length} links`,
    counts,
  );
}

// Never block a build: the banners keep the previous data file if parsing fails
try {
  main();
} catch (e) {
  console.warn(`article-anatomy.json not regenerated: ${e.message}`);
}
