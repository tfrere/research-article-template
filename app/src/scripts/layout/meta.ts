// Hero meta columns: author/affiliation tracing, "Show all" toggles, copy
// buttons, the Cite popover and PDF access for `pdfProOnly` articles.

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  ta.remove();
  return ok;
}

function wireTracing(box: HTMLElement) {
  const authors = [...box.querySelectorAll<HTMLElement>(".meta-authors li[data-aff]")];
  const affs = [...box.querySelectorAll<HTMLElement>(".meta-affs li[data-aff]")];
  const trace = (li: HTMLElement) => {
    const ids = (li.dataset.aff || "").split(" ");
    const isAuthor = !!li.closest(".meta-authors");
    box.classList.add("is-tracing");
    authors.forEach((a) =>
      a.classList.toggle(
        "on",
        isAuthor ? a === li : (a.dataset.aff || "").split(" ").some((x) => ids.includes(x)),
      ),
    );
    affs.forEach((f) => f.classList.toggle("on", ids.includes(f.dataset.aff || "")));
  };
  const clear = () => {
    box.classList.remove("is-tracing");
    box.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
  };
  [...authors, ...affs].forEach((li) => {
    li.addEventListener("mouseenter", () => trace(li));
    li.addEventListener("focusin", () => trace(li));
    li.addEventListener("mouseleave", clear);
    li.addEventListener("focusout", clear);
  });
}

function wireCitePopover(root: HTMLElement) {
  let open: { btn: HTMLElement; pop: HTMLElement } | null = null;
  const close = (focusBtn: boolean) => {
    if (!open) return;
    open.pop.hidden = true;
    open.btn.setAttribute("aria-expanded", "false");
    if (focusBtn) open.btn.focus();
    open = null;
  };
  root.querySelectorAll<HTMLElement>("[data-pop]").forEach((btn) => {
    const pop = document.getElementById(btn.dataset.pop || "");
    if (!pop) return;
    btn.addEventListener("click", () => {
      const wasOpen = !pop.hidden;
      close(false);
      if (wasOpen) return;
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      // Keep the popover inside the viewport
      pop.style.translate = "";
      const r = pop.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const dx = r.left < 12 ? 12 - r.left : r.right > vw - 12 ? vw - 12 - r.right : 0;
      if (dx) pop.style.translate = `calc(-50% + ${Math.round(dx)}px) 0`;
      pop.classList.remove("is-in");
      void pop.offsetWidth;
      pop.classList.add("is-in");
      (pop.querySelector<HTMLElement>("button, a") || pop).focus({ preventScroll: true });
      open = { btn, pop };
    });
    pop.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    });
  });
  document.addEventListener("click", (e) => {
    const t = e.target as Node;
    if (open && !open.pop.contains(t) && !open.btn.contains(t)) close(false);
  });
}

function wirePdfAccess(el: HTMLElement) {
  if (el.dataset.pdfProOnly !== "true") return;
  // Outside of the Hugging Face Space iframe there is no plan to ask for:
  // the PDF stays available (same fallback as before).
  const FALLBACK_MS = 3000;
  let done = false;
  const apply = (isPro: boolean) => {
    done = true;
    el.dataset.state = isPro ? "open" : "locked";
  };
  if (window.parent && window.parent !== window) {
    window.addEventListener("message", (event) => {
      if (event.data?.type === "USER_PLAN") apply(event.data.plan?.user === "pro");
    });
    window.parent.postMessage({ type: "USER_PLAN_REQUEST" }, "*");
    setTimeout(() => !done && apply(true), FALLBACK_MS);
  } else {
    apply(true);
  }
}

export function initMeta() {
  const box = document.querySelector<HTMLElement>(".meta-cols");
  if (!box) return;
  const live = box.querySelector<HTMLElement>("[data-meta-live]");

  if (box.hasAttribute("data-meta-trace")) wireTracing(box);
  wireCitePopover(box);
  box.querySelectorAll<HTMLElement>(".meta-pdf").forEach(wirePdfAccess);

  // "Show all N" expands the list in place and stays open until "Show fewer"
  box.querySelectorAll<HTMLButtonElement>(".meta-expand").forEach((btn) =>
    btn.addEventListener("click", () => {
      const list = document.getElementById(btn.getAttribute("aria-controls") || "");
      if (!list) return;
      const opening = list.classList.contains("is-collapsed");
      list.classList.toggle("is-collapsed", !opening);
      btn.setAttribute("aria-expanded", String(opening));
      btn.textContent = opening ? "Show fewer" : btn.dataset.more || "";
    }),
  );

  box.querySelectorAll<HTMLButtonElement>(".meta-copy[data-copy-value], .meta-copy[data-copy-from]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copyValue ?? document.getElementById(btn.dataset.copyFrom || "")?.textContent ?? "";
      await copyText(text);
      btn.textContent = "Copied";
      if (live) live.textContent = btn.dataset.copyDone || "Copied";
      setTimeout(() => (btn.textContent = "Copy"), 1400);
    }),
  );
}
