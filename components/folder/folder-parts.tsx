"use client";

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  MonitorIcon,
  MoonIcon,
  PresentationIcon,
  SunIcon,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { PaasterLogo } from "@/components/icons/paaster-logo";
import { stepDeskLook } from "@/lib/desk-style";
import { cn } from "@/lib/utils";

/* ---------- page frame ---------- */

const themes = [
  { value: "system", label: "system", Icon: MonitorIcon },
  { value: "light", label: "light", Icon: SunIcon },
  { value: "dark", label: "dark", Icon: MoonIcon },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const index = Math.max(
    0,
    themes.findIndex((t) => t.value === theme)
  );
  const { label, Icon } = themes[index];
  return (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-[18px]"
      title={`Theme: ${label}`}
      aria-label={`Theme: ${label}`}
      onClick={() => setTheme(themes[(index + 1) % themes.length].value)}
    >
      <Icon />
    </button>
  );
}

// Full-screen desk every page sits on: brand at the top left, theme toggle
// at the top right, then a centred heading. It grows with its content and
// the page itself scrolls: in a fixed box that scrolls on its own, mobile
// browsers hide their toolbar when you scroll down but don't bring it back
// when you scroll up again, leaving the header stuck underneath it.
export function DeskPage({
  title,
  subtitle,
  children,
  ...props
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
} & React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      className="absolute inset-x-0 top-0 z-40 min-h-full overflow-x-clip bg-desk bg-[radial-gradient(120%_70%_at_50%_0%,var(--color-desk-hi),var(--color-desk)_60%)] bg-fixed px-4 pb-12 text-sm text-foreground antialiased [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-2 [&_:focus-visible]:outline-primary motion-reduce:[&_*]:animate-none motion-reduce:[&_*]:transition-none"
    >
      <header className="mx-auto flex h-15 max-w-[760px] items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-base font-semibold tracking-tight"
        >
          <PaasterLogo size={24} className="translate-y-[0.375px]" />
          Paaster
        </Link>
        <ThemeToggle />
      </header>

      <div className="mx-auto mt-1 max-w-[520px] text-center">
        {/* Fixed-height heading (one-line title, two-line subtitle) so the
            folder sits in the same place on every page and state. */}
        <h1 className="truncate text-[clamp(20px,3.6vw,24px)]/[1.25] font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-1 min-h-10 text-sm/5 text-balance text-muted-foreground sm:line-clamp-2 sm:h-10">
          {subtitle}
        </p>
      </div>

      {children}
    </div>
  );
}

/* ---------- the folder ---------- */

// The folder: back panel, what's inside, a frosted front panel, and whatever
// sits on the front. `sealing` slides the contents down, `sealed` raises the
// front to close it. Children can read those via group-data-*/env.
// In the desk-stack style there are no panels: the sheets lie loose on the
// desk and draw together (`stacked`) when sealed.
export function Folder({
  inside,
  onFront,
  outside,
  sealing,
  sealed,
  drag,
}: {
  inside?: React.ReactNode;
  onFront?: React.ReactNode;
  // Positioned in stage coordinates, above the desk (e.g. popovers).
  outside?: React.ReactNode;
  sealing?: boolean;
  sealed?: boolean;
  drag?: boolean;
}) {
  // Swipe sideways on the desk to change its look (phones have no room for
  // the arrows).
  const touch = useRef<{ x: number; y: number }>(null);
  // --stage-scale is set before the first paint (see lib/stage.ts).
  return (
    <div
      className="relative mx-auto h-[calc(430px*var(--stage-scale,1))] w-[calc(560px*var(--stage-scale,1))]"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 2) {
          stepDeskLook(dx < 0 ? 1 : -1);
        }
      }}
    >
      {/* look arrows (desk stack, then each folder colour), beside the desk
          where there's room */}
      {(
        [
          [-1, "Previous style", ChevronLeftIcon, "-left-14"],
          [1, "Next style", ChevronRightIcon, "-right-14"],
        ] as const
      ).map(([direction, label, Icon, side]) => (
        <button
          key={direction}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => stepDeskLook(direction)}
          className={cn(
            "absolute top-[55%] z-10 hidden size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground min-[700px]:grid [&_svg]:size-5",
            side,
          )}
        >
          <Icon />
        </button>
      ))}
      <div className="absolute top-0 left-0 h-[430px] w-[560px] origin-top-left scale-(--stage-scale,1)">
        <div
          data-sealing={!!sealing}
          data-stacked={!!(sealing || sealed)}
          data-sealed={!!sealed}
          data-drag={!!drag}
          className="group/env absolute top-14 left-5 h-[360px] w-[520px]"
        >
          {/* soft shadow on the desk */}
          <div className="desk-stack:hidden pointer-events-none absolute inset-x-2 top-10 -bottom-2.5 rounded-[18px] bg-folder-shadow blur-[26px] after:absolute after:inset-x-[30px] after:bottom-1.5 after:h-[18px] after:rounded-full after:bg-folder-shadow after:blur-[8px] after:content-['']" />

          {/* back panel and tab: one continuous shape, so there's no seam */}
          <div className="desk-stack:hidden absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-folder)_86%,#fff)_0,var(--color-folder)_30px,var(--color-folder)_55%,var(--color-folder-deep)_100%)] [clip-path:path('M0_14_Q0_0_14_0_H146_C158_0_163_3_169_11_L176_20_C180_25_184_26_192_26_H502_Q520_26_520_44_V342_Q520_360_502_360_H18_Q0_360_0_342_Z')] group-data-[drag=true]/env:brightness-[1.12] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0)_2px),linear-gradient(rgba(255,255,255,.3),rgba(255,255,255,.3))] after:bg-no-repeat after:[background-position:0_0,190px_26px] after:[background-size:100%_100%,100%_1px] after:[clip-path:inherit] after:content-['']" />


          {inside}

          {/* frosted, see-through front panel */}
          <div className="desk-stack:hidden pointer-events-none absolute inset-x-0 top-[140px] bottom-0 z-[4] rounded-t-[14px] rounded-b-2xl bg-[linear-gradient(180deg,var(--color-folder-front),var(--color-folder-front-deep))] shadow-[inset_0_1.5px_0_var(--color-folder-rim),inset_0_0_0_1px_rgba(255,255,255,.22),inset_0_-14px_22px_-16px_rgba(0,30,80,.35),0_-10px_18px_-12px_rgba(0,25,70,.4)] backdrop-blur-md backdrop-saturate-150 transition-[top,backdrop-filter] group-data-[sealed=true]/env:backdrop-blur-[1.5px] duration-650 ease-[cubic-bezier(.4,0,.2,1)] group-data-[sealed=true]/env:top-[34px] before:absolute before:inset-0 before:rounded-[inherit] before:bg-[linear-gradient(112deg,rgba(255,255,255,.26),rgba(255,255,255,0)_34%,rgba(255,255,255,0)_72%,rgba(255,255,255,.08))] before:content-['']" />


          {onFront}
        </div>
        {outside}
      </div>
    </div>
  );
}

// A small, fixed wobble per sheet so the desk looks casually laid out.
const wobble = (k: number) => ((k * 7919) % 23) - 11;

// Where sheet k of n goes, for both desk styles; `sheet` picks the set that
// applies. Folder: fanned out across the folder mouth (--f*). Desk stack, in
// stage coordinates and inside the folder's box (x 20–540, from y 56) so
// both styles take up the same place: loose across the desk, centred (--d*;
// the password button sits on top of them), and drawn together into a
// compact, overlapping fan when sealed (--b*).
export function fanStyle(k: number, n: number) {
  const mid = (n - 1) / 2;
  const spread = n > 1 ? Math.min(54, 290 / (n - 1)) : 0;
  const d = k - mid;

  const sc = n > 7 ? 0.72 : n > 4 ? 0.84 : 1;
  const w = 128 * sc;
  const span = Math.min(470, 60 + n * 118 * sc);
  const step = n > 1 ? (span - w) / (n - 1) : 0;
  const bstep = n > 1 ? Math.min(24, 140 / (n - 1)) : 0;
  return {
    "--fx": `${(d * spread).toFixed(1)}px`,
    "--fy": `${(Math.abs(d) ** 2 * 2.2 + Math.abs(d) * 3).toFixed(1)}px`,
    "--fr": `${Math.max(-20, Math.min(20, d * (n > 6 ? 5 : 7))).toFixed(1)}deg`,
    "--fsc": n > 7 ? 0.82 : n > 5 ? 0.9 : 1,
    "--fz": 10 - Math.round(Math.abs(d)),
    "--dx": `${(280 - span / 2 + k * step - (128 - w) / 2).toFixed(1)}px`,
    "--dy": `${(64 + (k % 2 ? 26 : 0) + Math.abs(wobble(k)) - (184 - 184 * sc) / 2).toFixed(1)}px`,
    "--dr": `${(wobble(k) * 1.1).toFixed(1)}deg`,
    "--dsc": sc,
    "--dz": 10 - Math.trunc(Math.abs(d)),
    "--bx": `${(216 + d * bstep).toFixed(1)}px`,
    "--by": `${(72 + Math.abs(d) * 3).toFixed(1)}px`,
    "--br": `${(d * Math.min(3, 20 / Math.max(1, n - 1))).toFixed(1)}deg`,
    "--bz": k + 1,
  } as React.CSSProperties;
}

// Wrap the sheets in this so they sit between the back and front panels
// (straight on the desk in the desk-stack style).
export function Sheets({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-[2] [clip-path:inset(-420px_-120px_0_-120px)]">
      {children}
    </div>
  );
}

/* ---------- sheets of paper ---------- */

export const fileExt = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "file";

const caption =
  "absolute inset-x-2 bottom-[7px] truncate text-left font-mono text-[10px] text-paper-foreground-muted";

export function NoteSheet({ text, format }: { text: string; format: string }) {
  return (
    <span className="absolute inset-0 overflow-hidden rounded-lg bg-paper bg-[repeating-linear-gradient(180deg,transparent_0_17px,#e3e9f2_17px_18px)] [background-position:0_30px] px-[11px] py-3 text-left">
      <b className="mb-1 block font-mono text-[9px] font-semibold tracking-[.12em] text-paper-foreground-muted/75">
        TEXT · {format}
      </b>
      <p className="text-[11.5px] leading-[18px] break-words whitespace-pre-wrap text-paper-foreground">
        {text.slice(0, 160)}
      </p>
    </span>
  );
}

export function PhotoSheet({ src, name }: { src?: string; name: string }) {
  // Formats the browser can't draw (e.g. HEIC) fall back to an icon.
  const [broken, setBroken] = useState(false);
  return (
    <span className="absolute inset-0 rounded-lg bg-white px-2 pt-2 pb-7">
      {src && broken ? (
        <span className="grid size-full place-items-start justify-center rounded-md bg-paper-muted pt-[22px]">
          <FileImageIcon strokeWidth={1.5} className="size-14 text-[#0d9488]" />
        </span>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setBroken(true)}
          className="block size-full rounded-md bg-paper-muted object-cover"
        />
      ) : (
        <span className="block size-full animate-pulse rounded-md bg-paper-muted" />
      )}
      <span className={caption}>{name}</span>
    </span>
  );
}

// Icon and colour for a file that can't be previewed, by extension.
const FILE_KINDS: [string[], typeof FileIcon, string][] = [
  [["pdf"], FileTextIcon, "text-[#e5484d]"],
  [["doc", "docx", "odt", "rtf", "pages", "txt", "md"], FileTextIcon, "text-[#2f6fcf]"],
  [["xls", "xlsx", "ods", "csv", "tsv", "numbers"], FileSpreadsheetIcon, "text-[#1f9d55]"],
  [["ppt", "pptx", "odp", "key"], PresentationIcon, "text-[#e8710a]"],
  [["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"], FileArchiveIcon, "text-[#b7791f]"],
  [["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus"], FileAudioIcon, "text-[#8e4ec6]"],
  [["mp4", "mov", "avi", "mkv", "webm", "m4v"], FileVideoIcon, "text-[#d6409f]"],
  [["heic", "heif", "tif", "tiff", "psd", "raw", "cr2", "nef", "ico"], FileImageIcon, "text-[#0d9488]"],
  [
    ["js", "ts", "jsx", "tsx", "json", "html", "css", "py", "go", "rs", "java", "c", "cpp", "h", "php", "rb", "sh", "sql", "yml", "yaml", "xml", "swift", "kt"],
    FileCodeIcon,
    "text-[#475569]",
  ],
];

export function fileKind(name: string) {
  const ext = fileExt(name);
  const kind = FILE_KINDS.find(([exts]) => exts.includes(ext));
  return kind
    ? { Icon: kind[1], color: kind[2] }
    : { Icon: FileIcon, color: "text-primary" };
}

export function DocSheet({ name, size }: { name: string; size: string }) {
  const { Icon, color } = fileKind(name);
  return (
    <span className="absolute inset-0 overflow-hidden rounded-lg bg-paper">
      <span
        className={cn(
          "absolute top-2 left-[11px] font-mono text-xs font-bold tracking-[.06em] uppercase",
          color,
        )}
      >
        {fileExt(name)}
      </span>
      <Icon
        strokeWidth={1.5}
        className={cn("absolute top-[30px] left-1/2 size-14 -translate-x-1/2", color)}
      />
      <span className="absolute top-[96px] right-[18px] left-3 h-[36px] bg-[repeating-linear-gradient(180deg,#e4e9ef_0_3px,transparent_3px_11px)]" />
      <span className="absolute bottom-6 left-3 font-mono text-[10px] text-paper-foreground-muted">
        {size}
      </span>
      <span className={caption}>{name}</span>
    </span>
  );
}

/* ---------- round expiry sticker ---------- */

export function Sticker({
  burn,
  num,
  unit,
  className,
  ...props
}: {
  burn: boolean;
  num: React.ReactNode;
  unit: React.ReactNode;
} & React.ComponentProps<"button">) {
  const classes = cn(
    "absolute top-[244px] right-[34px] z-[5] grid size-[82px] rotate-8 content-center justify-items-center gap-px rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff1b8,var(--color-sticker)_60%,#f0b90f)] text-[#3b2a00] shadow-[0_3px_6px_rgba(10,30,70,.28),inset_0_-2px_3px_rgba(0,0,0,.12)] transition-[rotate,scale] data-[burn=true]:bg-[radial-gradient(circle_at_35%_30%,#ff9d86,#f0543a_60%,#c7321c)] data-[burn=true]:text-white",
    props.onClick && "cursor-pointer hover:scale-105 hover:rotate-0",
    className
  );
  const face = (
    <>
      <small className="font-mono text-[8px] font-semibold tracking-[.12em] opacity-70">
        {burn ? "BURN AFTER" : "EXPIRES IN"}
      </small>
      <b className="text-[22px] leading-none font-bold tracking-tight">
        {burn ? (
          "READ"
        ) : (
          <>
            {num}
            <em className="ml-px text-[11px] font-semibold not-italic">
              {unit}
            </em>
          </>
        )}
      </b>
    </>
  );
  // Read-only (the share page): a label, not a control.
  if (!props.onClick) {
    return (
      <div
        role="img"
        aria-label={props.title}
        title={props.title}
        data-burn={burn}
        className={classes}
      >
        {face}
      </div>
    );
  }
  return (
    <button type="button" data-burn={burn} {...props} className={classes}>
      {face}
    </button>
  );
}

/* ---------- small pieces ---------- */

// Small copy icon; shows a check for a moment after copying.
export function CopyButton({
  label,
  copied,
  onClick,
  className,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      aria-disabled={copied}
      onClick={() => !copied && onClick()}
      className={cn(
        "inline-grid size-4 shrink-0 cursor-pointer place-items-center rounded-full text-paper-foreground-muted transition-colors hover:bg-black/8 hover:text-paper-foreground [&_svg]:size-2.5",
        copied && "cursor-default text-key hover:bg-transparent hover:text-key",
        className
      )}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

/* ---------- shared class lists ---------- */

// A sheet of paper. Its place comes from the custom properties set by
// fanStyle(): the active style copies its set into --x/--y/--r/--sc, and
// sets the middle of the desk (--cx/--cy) that sheets rise out of.
// Folder: standing in the folder mouth.
// Desk stack: loose on the desk, or drawn together once sealed
// (stage coordinates, so the sheet is anchored at the stage's corner). On
// hover it comes to the front and its face (sheetFace) enlarges.
export const sheet =
  "group/item absolute h-[184px] w-[128px] origin-bottom [transform:translate(var(--x),var(--y))_rotate(var(--r))_scale(var(--sc,1))] transition-[transform,filter] duration-500 ease-[cubic-bezier(.25,1.2,.4,1)] " +
  "desk-folder:[--cx:0px] desk-folder:[--cy:0px] desk-folder:[--x:var(--fx)] desk-folder:[--y:var(--fy)] desk-folder:[--r:var(--fr)] desk-folder:[--sc:var(--fsc)] desk-folder:z-(--fz) desk-folder:bottom-[124px] desk-folder:left-[196px] desk-folder:drop-shadow-[0_2px_3px_rgba(20,30,50,.18)] desk-folder:hover:drop-shadow-[0_10px_14px_rgba(20,30,50,.25)] desk-folder:hover:[transform:translate(var(--x),calc(var(--y)_-_48px))_rotate(calc(var(--r)_*_.4))_scale(calc(var(--sc,1)_*_1.04))] desk-folder:has-focus-visible:[transform:translate(var(--x),calc(var(--y)_-_48px))_rotate(calc(var(--r)_*_.4))_scale(calc(var(--sc,1)_*_1.04))] desk-folder:group-data-[sealing=true]/env:duration-550 desk-folder:group-data-[sealing=true]/env:[transform:translate(var(--x),calc(var(--y)_+_22px))_rotate(var(--r))_scale(var(--sc,1))] " +
  "desk-stack:[--cx:216px] desk-stack:[--cy:72px] desk-stack:[--x:var(--dx)] desk-stack:[--y:var(--dy)] desk-stack:[--r:var(--dr)] desk-stack:[--sc:var(--dsc)] desk-stack:z-(--dz) desk-stack:-top-14 desk-stack:-left-5 desk-stack:origin-center desk-stack:duration-750 desk-stack:ease-[cubic-bezier(.4,0,.2,1)] desk-stack:[filter:drop-shadow(0_3px_4px_rgba(20,30,50,.18))_drop-shadow(0_1px_1px_rgba(20,30,50,.12))] desk-stack:group-data-[stacked=false]/env:hover:z-20 desk-stack:group-data-[stacked=false]/env:hover:duration-250 desk-stack:group-data-[stacked=false]/env:hover:[filter:drop-shadow(0_10px_12px_rgba(20,30,50,.22))_drop-shadow(0_2px_3px_rgba(20,30,50,.12))] desk-stack:group-data-[stacked=false]/env:has-focus-visible:z-20 desk-stack:group-data-[stacked=false]/env:has-focus-visible:duration-250 desk-stack:group-data-[stacked=true]/env:z-(--bz) desk-stack:group-data-[stacked=true]/env:[transform:translate(var(--bx),var(--by))_rotate(var(--br))]";

// The white card on the folder's front.
export const frontCard =
  "absolute top-[250px] left-[34px] z-[5] grid w-[300px] -rotate-[.6deg] rounded-lg bg-white px-4 shadow-[0_2px_5px_rgba(10,30,70,.22)]";

export const button =
  "inline-flex h-[42px] items-center gap-2 rounded-full border bg-card px-[18px] text-sm font-medium text-foreground transition-[translate,background-color] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-[17px]";
export const buttonPrimary = cn(
  button,
  "border-foreground bg-foreground font-semibold text-background hover:-translate-y-px hover:bg-foreground disabled:translate-y-0 disabled:border-transparent disabled:bg-foreground/15 disabled:text-foreground/45 disabled:opacity-100"
);
// A button showing "Copied": looks and acts inert until it resets.
export const copiedButton =
  "aria-disabled:cursor-default aria-disabled:hover:translate-y-0";
export const buttonRow = "mt-[18px] flex flex-wrap justify-center gap-2.5";
export const footnote =
  "mx-auto mt-3 max-w-[460px] text-center text-[12.5px] text-balance text-muted-foreground";

export const dialog =
  "m-auto w-[min(560px,calc(100vw-32px))] overflow-visible bg-transparent p-0 backdrop:bg-[rgba(8,14,24,.5)]";
export const paperDialog =
  "relative animate-folder-sheet rounded-lg bg-paper px-4 pt-3.5 pb-3.5 text-paper-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,.45)]";
// Expiry dates in running text: amber, like the sticker.
export const expiryText = "font-semibold text-amber-600 dark:text-amber-400";
export const iconButton =
  "grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-paper-muted text-paper-foreground-muted hover:bg-[#e6ebf1] hover:text-paper-foreground [&_svg]:size-3.5";
export const sheetButton =
  "h-[34px] cursor-pointer rounded-full border border-[#d6dde7] bg-white px-3.5 font-sans text-[13px] font-medium text-paper-foreground";

/* ---------- sheet actions ---------- */

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The clipboard only reliably takes PNG, so other images are redrawn as PNG.
export async function copyImage(blob: Blob) {
  let png = blob;
  if (blob.type !== "image/png") {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject()), "image/png"),
    );
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

// Round action buttons that appear on a sheet's corner on hover or focus;
// hidden while the folder is closing.
const sheetActions =
  "absolute top-1.5 right-1.5 z-[3] flex gap-1 opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100 group-data-[sealing=true]/env:hidden group-data-[sealed=true]/env:hidden [@media(hover:none)]:opacity-100";
const sheetAction =
  "grid size-5 cursor-pointer place-items-center rounded-full bg-band/90 text-white shadow-[0_1px_3px_rgba(0,0,0,.25)] hover:bg-band [&_svg]:size-2.5";

export function SheetAction({
  label,
  onClick,
  done,
  children,
}: {
  label: string;
  onClick: () => void;
  // Just done (e.g. "Copied"): inert until it resets.
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={done}
      className={cn(sheetAction, done && "cursor-default hover:bg-band/90")}
      onClick={() => !done && onClick()}
    >
      {children}
    </button>
  );
}

// Desk stack: the hover enlargement sits on this inner layer with its own
// short transition, so a sheet shrinks back quickly and its place in the
// pile (z-index on the outer layer) changes at once, without waiting for the
// longer move of the outer layer.
const sheetFace =
  "absolute inset-0 transition-[scale] duration-250 ease-out desk-stack:group-data-[stacked=false]/env:group-hover/item:scale-110 desk-stack:group-data-[stacked=false]/env:group-has-focus-visible/item:scale-110";

// A sheet on the desk: the whole sheet is one button, with its
// corner actions as sibling buttons (a button can't contain buttons).
export function SheetCard({
  label,
  onClick,
  disabled,
  className,
  style,
  actions,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div data-sheet className={cn(sheet, className)} style={style}>
      <div className={sheetFace}>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="absolute inset-0 cursor-pointer rounded-lg disabled:cursor-default"
        >
          {children}
        </button>
        {actions && <div className={sheetActions}>{actions}</div>}
      </div>
    </div>
  );
}
