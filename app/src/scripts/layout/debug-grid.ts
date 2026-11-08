// Debug grid overlay. Draws the live tracks of the page grid (read from the
// computed grid-template-columns of .content-grid, so it always reflects the
// tokens in src/styles/_grid.css), the named lines, the column spans, the
// sticky offset and a baseline. Loaded on demand by DebugGrid.astro.
//   G        toggle the overlay
//   Shift+G  toggle the baseline
import { onLayoutChange } from "./headings";

const CSS = `
.dg-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; display: none;
  font: 10px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; color: #111; }
html.debug-grid .dg-root { display: block; }
.dg-track { position: absolute; top: 0; bottom: 0; border-left: 1px dashed rgba(127, 127, 127, .55); }
.dg-track > span { position: absolute; top: 45%; left: 4px; right: 4px; padding: 2px 4px; border-radius: 3px;
  text-align: center; overflow: hidden; background: rgba(255, 255, 255, .85); }
.dg-track.toc { background: rgba(78, 121, 167, .10); }
.dg-track.body { background: rgba(89, 161, 79, .10); }
.dg-track.margin { background: rgba(240, 140, 60, .12); }
.dg-track.gap { background: repeating-linear-gradient(45deg, rgba(127, 127, 127, .12) 0 4px, transparent 4px 8px); }
.dg-track.outer { background: rgba(225, 87, 89, .06); }
.dg-line { position: absolute; top: 70px; color: #c00; writing-mode: vertical-rl; transform: translateX(-12px); white-space: nowrap; }
.dg-span { position: absolute; height: 14px; line-height: 12px; text-align: center; border: 1px solid rgba(0, 0, 0, .5);
  border-top: 0; background: rgba(255, 255, 255, .85); }
.dg-sticky { position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(200, 0, 0, .6); }
.dg-sticky > span { position: absolute; right: 8px; top: 2px; color: #c00; }
.dg-badge { position: absolute; left: 8px; bottom: 8px; padding: 4px 8px; border-radius: 4px; background: #111; color: #fff; }
.dg-baseline { position: absolute; inset: 0; display: none;
  background-image: linear-gradient(rgba(0, 160, 255, .22) 1px, transparent 1px); }
html.debug-grid-baseline .dg-baseline { display: block; }
[data-theme="dark"] .dg-root { color: #eee; }
[data-theme="dark"] .dg-track > span, [data-theme="dark"] .dg-span { background: rgba(15, 17, 21, .85); border-color: rgba(255, 255, 255, .5); }
[data-theme="dark"] .dg-line, [data-theme="dark"] .dg-sticky > span { color: #ff7a7a; }
`;

const SPANS: Array<[string, string, string]> = [
  ["body", "body-start", "body-end"],
  ["outset", "outset-start", "outset-end"],
  ["wide", "body-start", "margin-end"],
  ["page", "page-start", "page-end"],
  ["screen", "screen-start", "screen-end"],
];

const root = document.documentElement;
let overlay: HTMLElement | null = null;
let baseline: HTMLElement | null = null;

function setUrl(on: boolean) {
  try {
    const u = new URL(location.href);
    u.searchParams.delete("debug");
    if (on) u.searchParams.set("grid", "1");
    else u.searchParams.delete("grid");
    history.replaceState(history.state, "", u);
  } catch {}
}

function parseTracks(template: string) {
  const names: string[][] = [];
  const sizes: number[] = [];
  let current: string[] = [];
  const re = /\[([^\]]*)\]|([\d.]+)px/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    if (m[1] !== undefined) current.push(...m[1].trim().split(/\s+/).filter(Boolean));
    else {
      names.push(current);
      current = [];
      sizes.push(parseFloat(m[2]));
    }
  }
  names.push(current);
  return { names, sizes };
}

function el(cls: string, style: Partial<CSSStyleDeclaration>, html = "") {
  const d = document.createElement("div");
  d.className = cls;
  Object.assign(d.style, style);
  d.innerHTML = html;
  return d;
}

function draw() {
  if (!overlay || !root.classList.contains("debug-grid")) return;
  overlay.querySelectorAll(":scope > :not(.dg-baseline)").forEach((n) => n.remove());
  const grid = document.querySelector<HTMLElement>(".content-grid");
  if (!grid) return;
  const cs = getComputedStyle(grid);
  const rect = grid.getBoundingClientRect();
  const { names, sizes } = parseTracks(cs.gridTemplateColumns);
  const gap = parseFloat(cs.columnGap) || 0;
  const lineX: Record<string, number> = {};
  let x = rect.left + parseFloat(cs.paddingLeft);

  sizes.forEach((w, i) => {
    const start = names[i];
    const cls = start.includes("body-start")
      ? "body"
      : start.includes("margin-start")
        ? "margin"
        : start.includes("toc-start")
          ? "toc"
          : start.includes("screen-start") || start.includes("page-end") || w > 48
            ? "outer"
            : "gap";
    start.forEach((n) => (lineX[n] = x));
    overlay!.appendChild(
      el(`dg-track ${cls}`, { left: `${x}px`, width: `${w}px` }, `<span>${w >= 70 ? `${cls}<br>` : ""}${Math.round(w)}</span>`),
    );
    if (start.length) overlay!.appendChild(el("dg-line", { left: `${x}px` }, start.join(" ")));
    x += w + (i < sizes.length - 1 ? gap : 0);
  });
  names[sizes.length].forEach((n) => (lineX[n] = x));

  SPANS.forEach(([label, a, b], i) => {
    if (lineX[a] === undefined || lineX[b] === undefined) return;
    const w = lineX[b] - lineX[a];
    overlay!.appendChild(
      el("dg-span", { left: `${lineX[a]}px`, width: `${w}px`, bottom: `${40 + i * 18}px` }, `${label} ${Math.round(w)}px`),
    );
  });

  const stickyTop = getComputedStyle(root).getPropertyValue("--layout-sticky-top").trim();
  overlay.appendChild(el("dg-sticky", { top: stickyTop }, `<span>sticky ${stickyTop}</span>`));

  const single = sizes.length <= 3;
  const tier = single ? "single column" : window.matchMedia("(min-width: 1280px)").matches ? "rail + margin" : "compact rail";
  overlay.appendChild(el("dg-badge", {}, `${root.clientWidth}px | ${tier} | G grid, Shift+G baseline`));
  syncBaseline();
}

function syncBaseline() {
  if (!baseline) return;
  const step = parseFloat(getComputedStyle(root).getPropertyValue("--layout-baseline")) || 8;
  baseline.style.backgroundSize = `100% ${step}px`;
  baseline.style.backgroundPosition = `0 ${-(window.scrollY % step)}px`;
}

function mount() {
  if (overlay) return;
  const style = document.createElement("style");
  style.dataset.debugGrid = "";
  style.textContent = CSS;
  document.head.appendChild(style);
  overlay = el("dg-root", {});
  overlay.setAttribute("aria-hidden", "true");
  baseline = el("dg-baseline", {});
  overlay.appendChild(baseline);
  root.classList.add("debug-grid-baseline");
  document.body.appendChild(overlay);
  onLayoutChange(draw);
  window.addEventListener("scroll", syncBaseline, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as Element | null)?.closest?.("input, textarea, select, [contenteditable]")) return;
    if (e.shiftKey) root.classList.toggle("debug-grid-baseline");
    else toggleDebugGrid();
  });
}

export function toggleDebugGrid(force?: boolean) {
  mount();
  const on = force ?? !root.classList.contains("debug-grid");
  root.classList.toggle("debug-grid", on);
  setUrl(on);
  draw();
}
