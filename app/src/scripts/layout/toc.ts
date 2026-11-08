// Table of contents ("line" variant): a hairline rail that fills as you read,
// an indicator on the active item, read sections dimmed, reading time left.
// Sub-headings are expanded unless the nav has data-toc-expanded="false"
// (frontmatter `tocExpanded: false`), then only the active section expands.
// Below the collapse breakpoint the nav is hidden and a slim top bar opens it
// as a drawer.
import {
  articleHeadings,
  countWords,
  getArticleRoot,
  headingLabel,
  onLayoutChange,
  prefersReducedMotion,
} from "./headings";

type Head = { el: HTMLElement; id: string; level: 2 | 3; label: string; top: number };
type Section = Head & { subs: Head[]; start: number; end: number };

const WORDS_PER_MINUTE = 230;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const docTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY;

export function initToc() {
  const nav = document.getElementById("toc");
  const main = getArticleRoot();
  if (!nav || !main) return;
  const root = document.documentElement;
  const grid = nav.closest<HTMLElement>(".content-grid");
  const listHost = nav.querySelector<HTMLElement>("[data-toc-list]");
  const topbar = document.querySelector<HTMLElement>("[data-toc-topbar]");
  const openBtn = topbar?.querySelector<HTMLButtonElement>("[data-toc-open]") ?? null;
  const backdrop = document.querySelector<HTMLElement>("[data-toc-backdrop]");

  // Outline: h2 sections with their h3 children (h3 become sections if there is no h2)
  const heads: Head[] = articleHeadings(main, "h2, h3").map((el) => ({
    el,
    id: el.id,
    level: el.tagName === "H2" ? 2 : 3,
    label: headingLabel(el),
    top: 0,
  }));
  const topLevel = heads.some((h) => h.level === 2) ? 2 : 3;
  const secs: Section[] = [];
  heads.forEach((h) => {
    if (h.level === topLevel) secs.push(Object.assign(h, { subs: [], start: 0, end: 0 }));
    else if (secs.length) secs[secs.length - 1].subs.push(h);
  });

  const totalMins = Math.max(1, Math.round(countWords(main) / WORDS_PER_MINUTE));
  document.querySelectorAll("[data-read-time]").forEach((el) => {
    el.textContent = `${totalMins} min read`;
  });

  // --vw feeds the rail and margin widths in _grid.css (viewport without scrollbar)
  const setVw = () => root.style.setProperty("--vw", `${root.clientWidth}px`);

  if (!secs.length || !listHost) {
    nav.hidden = true;
    if (topbar) topbar.hidden = true;
    onLayoutChange(setVw);
    return;
  }

  listHost.innerHTML = secs
    .map(
      (s, i) =>
        `<li class="toc-sec" data-sec="${i}"><a href="#${esc(s.id)}">${esc(s.label)}</a>${
          s.subs.length
            ? `<div class="toc-sub"><ol>${s.subs
                .map((h) => `<li><a href="#${esc(h.id)}">${esc(h.label)}</a></li>`)
                .join("")}</ol></div>`
            : ""
        }</li>`,
    )
    .join("");

  const list = nav.querySelector<HTMLElement>(".toc-list");
  const scroller = nav.querySelector<HTMLElement>("[data-toc-scroll]");
  const indicator = nav.querySelector<HTMLElement>(".toc-indicator");
  const fill = nav.querySelector<HTMLElement>(".toc-fill");
  const metaEls = document.querySelectorAll<HTMLElement>("[data-toc-meta]");
  const secEl = topbar?.querySelector<HTMLElement>("[data-toc-sec]");
  const subEl = topbar?.querySelector<HTMLElement>("[data-toc-sub]");
  const progressEl = topbar?.querySelector<HTMLElement>("[data-toc-progress]");
  const fullBleeds = [...main.querySelectorAll<HTMLElement>(":scope > .full-width")];

  const state = {
    active: null as Head | null,
    si: -1,
    lock: null as { id: string; until: number } | null,
    collapsed: false,
    start: 0,
    end: 0,
  };

  function measure() {
    const mainBottom = docTop(main!) + main!.offsetHeight;
    heads.forEach((h) => (h.top = docTop(h.el)));
    secs.forEach((s, i) => {
      s.start = s.top;
      s.end = secs[i + 1] ? secs[i + 1].top : mainBottom;
    });
    state.start = docTop(main!);
    state.end = mainBottom;
  }

  // Reading line at 30% of the viewport, sliding to the bottom over the last
  // screen so that short final sections still become active.
  function readPos() {
    const vh = window.innerHeight;
    const left = root.scrollHeight - vh - window.scrollY;
    let line = vh * 0.3;
    if (left < vh * 0.7) line += (vh * 0.7 - 16) * (1 - Math.max(0, left) / (vh * 0.7));
    return window.scrollY + line;
  }

  function positionLine(f: number[]) {
    const a = nav!.querySelector<HTMLElement>("a[aria-current]");
    const li = list?.querySelector<HTMLElement>(`.toc-sec[data-sec="${state.si}"]`);
    if (!list || !a || !li || !indicator || !fill) return;
    const lr = list.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    const r = li.getBoundingClientRect();
    indicator.style.transform = `translateY(${(ar.top - lr.top).toFixed(1)}px)`;
    indicator.style.height = `${ar.height.toFixed(1)}px`;
    fill.style.height = `${(r.top - lr.top + f[state.si] * r.height).toFixed(1)}px`;
    if (!nav!.classList.contains("is-ready")) requestAnimationFrame(() => nav!.classList.add("is-ready"));
  }

  // Keep the active item visible when the TOC is taller than the viewport
  function keepInView() {
    const a = nav!.querySelector<HTMLElement>("a[aria-current]");
    if (!scroller || !a || scroller.scrollHeight <= scroller.clientHeight + 1) return;
    const sr = scroller.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    if (ar.top < sr.top + 24 || ar.bottom > sr.bottom - 24) {
      scroller.scrollTo({
        top: scroller.scrollTop + (ar.top - sr.top) - sr.height / 2 + ar.height / 2,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    }
  }

  let lineAnim = 0;
  function update(force = false) {
    const pos = readPos();
    let active = heads[0];
    for (const h of heads) if (h.top <= pos + 1) active = h;
    if (state.lock) {
      if (performance.now() < state.lock.until)
        active = heads.find((h) => h.id === state.lock!.id) || active;
      else state.lock = null;
    }
    let si = 0;
    secs.forEach((s, i) => {
      if (s.top <= active.top) si = i;
    });
    const f = secs.map((s) => clamp01((pos - s.start) / (s.end - s.start)));
    const overall = clamp01((pos - state.start) / (state.end - state.start));
    const changed = force || active !== state.active;
    state.active = active;
    state.si = si;

    if (changed) {
      nav!.querySelectorAll("a[aria-current]").forEach((a) => a.removeAttribute("aria-current"));
      nav!.querySelectorAll(`a[href="#${CSS.escape(active.id)}"]`).forEach((a) => a.setAttribute("aria-current", "true"));
    }
    const minsLeft = Math.ceil(totalMins * (1 - overall));
    const meta =
      overall >= 0.995 ? "Finished" : pos <= secs[0].start + 2 ? `${totalMins} min read` : `${minsLeft} min left`;
    metaEls.forEach((m) => (m.textContent = meta));

    nav!.querySelectorAll<HTMLElement>(".toc-sec").forEach((li, i) => {
      li.classList.toggle("is-active", i === si);
      li.classList.toggle("is-open", i === si);
      li.classList.toggle("is-read", i < si);
    });
    positionLine(f);
    if (changed && !prefersReducedMotion()) {
      // Follow the sub-heading expand / collapse transition
      cancelAnimationFrame(lineAnim);
      const t0 = performance.now();
      const step = () => {
        positionLine(f);
        if (performance.now() - t0 < 280) lineAnim = requestAnimationFrame(step);
      };
      lineAnim = requestAnimationFrame(step);
    }

    // Slim top bar, only when the TOC column is hidden and the article has started
    if (secEl) secEl.textContent = secs[si].label;
    if (subEl) subEl.textContent = active.level !== secs[si].level ? active.label : "";
    if (progressEl) progressEl.style.transform = `scaleX(${overall.toFixed(4)})`;
    const started = (grid?.getBoundingClientRect().top ?? 0) < 0;
    root.classList.toggle("toc-topbar-visible", state.collapsed && started);

    // Stuck: the sticky TOC reached its top offset ("x min read" shows up)
    const stickyTop = parseFloat(getComputedStyle(nav!).top) || 0;
    nav!.classList.toggle("is-stuck", !state.collapsed && nav!.getBoundingClientRect().top <= stickyTop + 0.5);

    // Fade the TOC while a full-bleed block passes over its column
    if (!root.classList.contains("toc-open") && !state.collapsed && fullBleeds.length) {
      const nr = nav!.getBoundingClientRect();
      const occluded = fullBleeds.some((el) => {
        const r = el.getBoundingClientRect();
        return r.top < nr.bottom + 8 && r.bottom > nr.top - 8;
      });
      nav!.classList.toggle("is-occluded", occluded && !nav!.matches(":focus-within"));
    } else nav!.classList.remove("is-occluded");

    if (changed) keepInView();
  }

  function refresh() {
    setVw();
    if (!root.classList.contains("toc-open")) {
      state.collapsed = getComputedStyle(nav!).display === "none";
    }
    measure();
    update(true);
  }

  function openDrawer() {
    root.classList.add("toc-open");
    openBtn?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      update(true);
      (nav!.querySelector<HTMLElement>("a[aria-current]") || nav!.querySelector<HTMLElement>("a"))?.focus({
        preventScroll: true,
      });
    });
  }
  function closeDrawer() {
    if (!root.classList.contains("toc-open")) return;
    root.classList.remove("toc-open");
    openBtn?.setAttribute("aria-expanded", "false");
  }
  openBtn?.addEventListener("click", openDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  // Links keep native fragment navigation; the indicator stays on the target
  // while the smooth scroll runs, then focus moves to the heading.
  nav.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute("href")!.slice(1));
    const t = document.getElementById(id);
    if (!t) return;
    state.lock = { id, until: performance.now() + 1500 };
    if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
    closeDrawer();
    if (prefersReducedMotion()) {
      e.preventDefault();
      t.scrollIntoView();
      history.replaceState(null, "", `#${id}`);
    }
    requestAnimationFrame(() => t.focus({ preventScroll: true }));
    update(true);
  });
  nav.addEventListener("keydown", (e) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const links = [...nav.querySelectorAll<HTMLElement>('a[href^="#"]')].filter(
      (a) => a.offsetParent !== null && getComputedStyle(a).visibility !== "hidden",
    );
    const i = links.indexOf(document.activeElement as HTMLElement);
    let j = e.key === "Home" ? 0 : e.key === "End" ? links.length - 1 : i + (e.key === "ArrowDown" ? 1 : -1);
    j = Math.max(0, Math.min(links.length - 1, j));
    links[j]?.focus();
    e.preventDefault();
    e.stopPropagation();
  });

  ["wheel", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, () => (state.lock = null), { passive: true }),
  );
  window.addEventListener("scrollend", () => {
    state.lock = null;
    update();
  });
  let scrollRaf = 0;
  window.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => update());
    },
    { passive: true },
  );

  onLayoutChange(refresh);
}
