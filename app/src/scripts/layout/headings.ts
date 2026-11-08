// Shared helpers for the article layout scripts (TOC, heading anchors,
// sidenotes, debug grid).

export const getArticleRoot = () =>
  document.querySelector<HTMLElement>("section.content-grid > main");

// Headings that are not part of the article outline
const OUTLINE_SKIP = ".sr-only, .footnotes, .html-embed, [data-no-toc], footer";

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-") || "section";

/** Heading text without the anchor icon and KaTeX's hidden MathML copy */
export function headingLabel(h: HTMLElement): string {
  const c = h.cloneNode(true) as HTMLElement;
  c.querySelectorAll(".h-anchor, .katex-mathml").forEach((n) => n.remove());
  return (c.textContent || "").replace(/\s+/g, " ").trim();
}

/**
 * Article headings in document order. Headings rendered without an id (raw
 * JSX, components) get a unique slug, so the TOC and the anchors agree.
 */
export function articleHeadings(main: HTMLElement, selector = "h2, h3, h4"): HTMLElement[] {
  const used = new Set(Array.from(document.querySelectorAll("[id]"), (el) => el.id));
  return Array.from(main.querySelectorAll<HTMLElement>(selector))
    .filter((h) => !h.closest(OUTLINE_SKIP))
    .map((h) => {
      if (!h.id) {
        const base = slugify(headingLabel(h));
        let id = base;
        let n = 1;
        while (used.has(id)) id = `${base}-${n++}`;
        h.id = id;
        used.add(id);
      }
      return h;
    });
}

const WORDS_SKIP = "script, style, svg, pre, .katex-mathml, .html-embed, .h-anchor";

export function countWords(root: HTMLElement): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(WORDS_SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  let words = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode.nodeValue;
    if (text) words += text.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

/**
 * Run `cb` (once per frame) whenever the layout may have moved: resize, late
 * fonts, page load, and any size change of the article (embeds, images).
 */
export function onLayoutChange(cb: () => void) {
  let raf = 0;
  const run = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(cb);
  };
  window.addEventListener("resize", run);
  window.addEventListener("load", run);
  document.fonts?.ready.then(run);
  const main = getArticleRoot();
  if (main && "ResizeObserver" in window) new ResizeObserver(run).observe(main);
  run();
  return run;
}

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
