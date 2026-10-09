// Desk looks, switched with the arrows beside the stage (or a swipe on
// phones): the desk stack first, then the folder in each of its colours.
// Applied as <html data-desk-style> (read by the desk-folder: / desk-stack:
// variants) and <html data-folder-color> (the palettes), both in
// app/globals.css.
export const DESK_LOOKS = [
  "stack",
  "blue",
  "green",
  "purple",
  "orange",
  "graphite",
] as const;
type DeskLook = (typeof DESK_LOOKS)[number];

const KEY = "paaster:desk-look";

// Runs in <head> before the first paint: the remembered look, or the desk
// stack on a first visit.
export const deskLookScript = `(function(){var l=${JSON.stringify(DESK_LOOKS)},v;try{v=localStorage.getItem(${JSON.stringify(KEY)})}catch(e){}if(l.indexOf(v)<0)v=l[0];var r=document.documentElement;r.setAttribute("data-desk-style",v==="stack"?"stack":"folder");r.setAttribute("data-folder-color",v==="stack"?"blue":v)})()`;

// Switching between the folder and the desk stack puts every sheet in a new
// layout: float them up out of the middle of the desk, the way new sheets
// arrive (sheet-rise in app/globals.css), instead of sliding them across from
// where they were.
function dropSheets(sheets: HTMLElement[]) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  sheets.forEach((el, i) => {
    const style = getComputedStyle(el);
    const cx = style.getPropertyValue("--cx").trim() || "0px";
    const cy = parseFloat(style.getPropertyValue("--cy")) || 0;
    el.animate(
      // One keyframe at the start: it ends on the sheet's own place.
      [
        {
          offset: 0,
          transform: `translate(${cx}, ${cy + 40}px) scale(0.5)`,
          opacity: 0,
        },
      ],
      {
        duration: 600,
        delay: i * 30,
        easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
        fill: "backwards",
      },
    );
  });
}

// Moves to the previous (-1) or next (+1) look.
export function stepDeskLook(direction: 1 | -1) {
  const root = document.documentElement;
  const current =
    root.dataset.deskStyle === "stack" ? "stack" : root.dataset.folderColor;
  const index = Math.max(DESK_LOOKS.indexOf(current as DeskLook), 0);
  const next =
    DESK_LOOKS[(index + direction + DESK_LOOKS.length) % DESK_LOOKS.length];
  root.classList.add("folder-color-fade");
  const style = next === "stack" ? "stack" : "folder";
  // Jump the sheets to the new layout without their transition, then float
  // them in.
  const sheets =
    style === root.dataset.deskStyle
      ? []
      : [...document.querySelectorAll<HTMLElement>("[data-sheet]")];
  sheets.forEach((el) => (el.style.transition = "none"));
  root.dataset.deskStyle = style;
  root.dataset.folderColor = next === "stack" ? "blue" : next;
  if (sheets.length) {
    sheets.forEach((el) => {
      void el.offsetWidth; // apply the new layout before the transition returns
      el.style.transition = "";
    });
    dropSheets(sheets);
  }
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode or blocked storage: the look still changes.
  }
}
