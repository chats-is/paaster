// The folder stage (Folder in components/folder/folder-parts.tsx) is drawn
// at 560 × 430 and scaled down to fit narrow screens with a 16px gutter on
// each side.
//
// This runs in <head> before the first paint and keeps --stage-scale on
// <html> in step with the viewport, so the folder is drawn at the right size
// from the start instead of shrinking once React has loaded.
export const stageScaleScript = `(function(){var r=document.documentElement;function f(){r.style.setProperty("--stage-scale",String(Math.min(1,(r.clientWidth-32)/560)))}f();addEventListener("resize",f)})()`;
