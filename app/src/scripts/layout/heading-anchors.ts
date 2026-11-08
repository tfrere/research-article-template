// Heading anchors: clicking the link icon copies the section URL ("Copied"
// tip), and the page lands where the URL says: at the top without a hash, on
// the target heading with one (re-applied while late layout settles, until
// the reader scrolls on their own).
import {
  articleHeadings,
  getArticleRoot,
  headingLabel,
  onLayoutChange,
  prefersReducedMotion,
} from "./headings";

// Same icon as plugins/rehype/heading-anchors.mjs, for headings rendered outside markdown
const LINK_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l2.2-2.2a2.8 2.8 0 0 0-4-4l-.9.9"/><path d="M9.2 6.8a2.8 2.8 0 0 0-4 0L3 9a2.8 2.8 0 0 0 4 4l.9-.9"/></svg>';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function settleInitialScroll() {
  const id = decodeURIComponent(location.hash.slice(1));
  let settled = false;
  const stop = () => {
    settled = true;
  };
  ["wheel", "touchstart", "keydown", "pointerdown"].forEach((ev) =>
    window.addEventListener(ev, stop, { once: true, passive: true }),
  );
  setTimeout(stop, 4000);
  const apply = () => {
    if (settled) return;
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
    else if (!id) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  };
  apply();
  onLayoutChange(apply);
}

export function initHeadingAnchors() {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const main = getArticleRoot();
  if (!main) return;

  const live = document.createElement("span");
  live.className = "sr-only";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);

  for (const h of articleHeadings(main)) {
    let a = h.querySelector<HTMLAnchorElement>(":scope > a.h-anchor");
    if (!a) {
      a = document.createElement("a");
      a.className = "h-anchor";
      a.href = `#${h.id}`;
      a.innerHTML = LINK_ICON;
      h.appendChild(a);
    }
    a.setAttribute("aria-label", `Link to section: ${headingLabel(h)}`);
  }

  main.addEventListener("click", async (e) => {
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a.h-anchor");
    const h = a?.parentElement;
    if (!a || !h?.id) return;
    e.preventDefault();
    history.replaceState(null, "", `#${h.id}`);
    if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
    h.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    const ok = await copyText(location.href);
    a.classList.remove("is-copied");
    void a.offsetWidth;
    a.classList.add("is-copied");
    live.textContent = ok ? "Section link copied" : "Section link updated in the address bar";
    clearTimeout(Number(a.dataset.copiedTimer));
    a.dataset.copiedTimer = String(window.setTimeout(() => a.classList.remove("is-copied"), 1400));
  });

  settleInitialScroll();
}
