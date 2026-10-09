// Folder colours, defined in app/globals.css as <html data-folder-color>.
export const FOLDER_COLORS = [
  "blue",
  "green",
  "purple",
  "orange",
  "graphite",
] as const;

const KEY = "paaster:folder-color";

// Runs in <head> before the first paint: a random colour on every visit,
// never the same one twice in a row.
export const folderColorScript = `(function(){var c=${JSON.stringify(FOLDER_COLORS)},k=${JSON.stringify(KEY)},l;try{l=localStorage.getItem(k)}catch(e){}var o=c.filter(function(x){return x!==l}),p=o[Math.floor(Math.random()*o.length)];document.documentElement.setAttribute("data-folder-color",p);try{localStorage.setItem(k,p)}catch(e){}})()`;

// Moves to the previous (-1) or next (+1) colour.
export function stepFolderColor(direction: 1 | -1) {
  const root = document.documentElement;
  const current = FOLDER_COLORS.indexOf(
    root.dataset.folderColor as (typeof FOLDER_COLORS)[number],
  );
  const next =
    FOLDER_COLORS[
      (Math.max(current, 0) + direction + FOLDER_COLORS.length) %
        FOLDER_COLORS.length
    ];
  root.classList.add("folder-color-fade");
  root.dataset.folderColor = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Private mode or blocked storage: the colour still changes.
  }
}
