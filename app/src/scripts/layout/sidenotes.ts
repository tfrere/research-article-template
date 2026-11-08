// Margin sidenotes: align each note with the element it annotates, then push
// it down when it would overlap the previous note or a figure that breaks out
// into the margin column.
import { getArticleRoot, onLayoutChange } from "./headings";

const GAP = 12;
let started = false;

export function initSidenotes() {
  if (started) return;
  started = true;
  const main = getArticleRoot();
  if (!main) return;
  const notes = [...main.querySelectorAll<HTMLElement>(":scope > .sidenote")];
  if (!notes.length) return;
  const breakouts = [...main.querySelectorAll<HTMLElement>(":scope > :is(.wide, .full-width, .html-embed--wide)")];

  const place = () => {
    notes.forEach((n) => (n.style.transform = ""));
    const inMargin = notes.filter(
      (n) => getComputedStyle(n).getPropertyValue("--sidenote-in-margin").trim() === "1",
    );
    if (!inMargin.length) return;
    const obstacles = breakouts.map((el) => el.getBoundingClientRect());
    const placed: Array<{ top: number; bottom: number }> = [];
    for (const n of inMargin) {
      const r = n.getBoundingClientRect();
      const height = n.scrollHeight;
      const anchor = n.previousElementSibling;
      let y = anchor ? anchor.getBoundingClientRect().top : r.top;
      const blocks = obstacles
        .filter((o) => o.right > r.left + 1 && o.left < r.left + n.offsetWidth - 1)
        .map((o) => ({ top: o.top, bottom: o.bottom }))
        .concat(placed);
      for (let moved = true, guard = 0; moved && guard < 50; guard++) {
        moved = false;
        for (const b of blocks) {
          if (y < b.bottom + GAP && y + height > b.top - GAP) {
            y = b.bottom + GAP;
            moved = true;
          }
        }
      }
      if (Math.round(y - r.top)) n.style.transform = `translateY(${Math.round(y - r.top)}px)`;
      placed.push({ top: y, bottom: y + height });
    }
  };

  onLayoutChange(place);
}
