"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  PenLineIcon,
  PlusIcon,
  RotateCwIcon,
  SendIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Editor } from "@/components/editor";
import {
  button,
  buttonPrimary,
  buttonRow,
  copiedButton,
  CopyButton,
  copyImage,
  DeskPage,
  dialog,
  DocSheet,
  download,
  expiryText,
  fanStyle,
  fileExt,
  Folder,
  footnote,
  frontCard,
  iconButton,
  NoteSheet,
  paperDialog,
  PhotoSheet,
  SheetAction,
  sheetButton,
  SheetCard,
  Sheets,
  Sticker,
} from "@/components/folder/folder-parts";
import { PasswordIcon } from "@/components/icons/password-icon";
import {
  MAX_FILE_COUNT,
  MAX_TOTAL_SIZE_BYTES,
  MAX_TOTAL_SIZE_MB,
} from "@/lib/config";
import { encryptContent } from "@/lib/crypto";
import { cn, editorLanguages, formatSize, generateId } from "@/lib/utils";

const EXPIRES = [
  ["10m", "10", "min", "10 minutes"],
  ["30m", "30", "min", "30 minutes"],
  ["1h", "1", "hr", "1 hour"],
  ["6h", "6", "hr", "6 hours"],
  ["12h", "12", "hr", "12 hours"],
  ["1d", "1", "day", "1 day"],
  ["3d", "3", "days", "3 days"],
  ["7d", "7", "days", "7 days"],
] as const;

type Entry = { file: File; preview?: string };
type Pop = "add" | "addBar" | "expiry" | null;
// open → sealing (contents slide in) → closed (front rises, strap on) → sent
type Phase = "open" | "sealing" | "closed" | "sent";

// Clipboard images always arrive as "image.png"; name them so repeated
// pastes aren't dropped as duplicates.
function renamePasted(file: File) {
  if (!/^image\.\w+$/.test(file.name)) return file;
  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
  return new File([file], `screenshot-${stamp}.${fileExt(file.name)}`, {
    type: file.type,
  });
}

const wait = (ms: number) =>
  new Promise((r) =>
    setTimeout(
      r,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms,
    ),
  );

export function ShareFolder() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [format, setFormat] = useState("plaintext");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expires, setExpires] = useState("1d");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("open");
  const [shareLink, setShareLink] = useState<string>();
  const [pop, setPop] = useState<Pop>(null);
  const [dragging, setDragging] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const fileInput = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDialogElement>(null);
  const sheetInput = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ text: "", format: "plaintext" });
  const [viewing, setViewing] = useState<Entry>();

  const burnAfterRead = expires === "b";
  const [, expNum, expUnit, expLabel] =
    EXPIRES.find(([v]) => v === expires) ?? EXPIRES[5];
  const passwordInvalid =
    !!password && (password.length < 6 || password.length > 12);
  const locked = !!password && !passwordInvalid;
  const busy = phase !== "open";
  const closed = phase === "closed" || phase === "sent";
  const hasContent = !!text.trim() || entries.length > 0;
  const canSeal = hasContent && !passwordInvalid && !busy;
  const totalSize = entries.reduce((s, e) => s + e.file.size, 0);

  /* ---------- adding ---------- */
  // Object URLs for image previews, released when they're removed or the page
  // goes away.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const revoke = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previews.current.delete(url);
  };

  const addFiles = (list: File[]) => {
    if (busy || list.length === 0) return;
    const accepted: Entry[] = [];
    let size = totalSize;
    for (const f of list) {
      const all = [...entries, ...accepted];
      if (all.some((e) => e.file.name === f.name && e.file.size === f.size)) {
        continue;
      }
      if (all.length >= MAX_FILE_COUNT) {
        toast.error(`You can add up to ${MAX_FILE_COUNT} files`);
        break;
      }
      if (size + f.size > MAX_TOTAL_SIZE_BYTES) {
        toast.error(`Total size can't exceed ${MAX_TOTAL_SIZE_MB}MB`);
        break;
      }
      const preview = f.type.startsWith("image/")
        ? URL.createObjectURL(f)
        : undefined;
      if (preview) previews.current.add(preview);
      accepted.push({ file: f, preview });
      size += f.size;
    }
    if (accepted.length === 0) return;
    setFresh(new Set(accepted.map((a) => a.file.name + a.file.size)));
    setEntries((prev) => [...prev, ...accepted]);
  };

  const copyImageOf = async (key: string, file: File) => {
    if (copiedKey === key) return;
    try {
      await copyImage(file);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(undefined), 1500);
      toast.success("Image copied");
    } catch {
      toast.error("This browser can't copy images — download it instead");
    }
  };

  const removeEntry = (entry: Entry) => {
    revoke(entry.preview);
    setEntries((prev) => prev.filter((e) => e !== entry));
  };

  /* ---------- the writing sheet ---------- */
  const openSheet = () => {
    setDraft({ text, format });
    sheet.current?.showModal();
    requestAnimationFrame(() =>
      sheetInput.current?.querySelector<HTMLElement>(".cm-content")?.focus(),
    );
  };
  const saveSheet = () => {
    if (!text && draft.text) setFresh(new Set(["text"]));
    setText(draft.text);
    setFormat(draft.format);
    sheet.current?.close();
  };

  /* ---------- closing the folder = encrypt + publish ---------- */
  const publish = async () => {
    const content = text.trim() ? text : undefined;
    const files = entries.map((e) => e.file);
    const { fragment, encryptedText, encryptedFiles } = await encryptContent(
      content,
      files,
      password || undefined,
    );

    const formData = new FormData();
    formData.append("expires", expires);
    if (title.trim()) formData.append("title", title.trim());
    if (password) formData.append("hasPassword", "true");
    if (content && encryptedText) {
      formData.append("format", format);
      formData.append("text", encryptedText);
    }
    files.forEach((f, i) => {
      const encryptedFile = encryptedFiles[i];
      if (!encryptedFile) return;
      formData.append("attachment_data", encryptedFile, "encrypted.bin");
      formData.append("attachment_name", f.name);
      formData.append("attachment_size", (f.size / (1024 * 1024)).toFixed(2));
    });

    const res = await fetch("/api", { method: "POST", body: formData });
    if (!res.ok)
      throw new Error(
        (await res.text()) || "Publishing failed — please try again",
      );
    const { id } = await res.json();
    return `${window.location.origin}/${id}#${fragment}`;
  };

  const seal = async () => {
    if (!canSeal) return;
    setPop(null);
    setPhase("sealing");
    const [result] = await Promise.allSettled([publish(), wait(480)]);
    if (result.status === "rejected") {
      setPhase("open");
      toast.error(
        result.reason instanceof Error
          ? result.reason.message
          : "Publishing failed — please try again",
      );
      return;
    }
    setShareLink(result.value);
    setPhase("closed");
    await wait(1000);
    setPhase("sent");
  };

  const reset = () => {
    entries.forEach((e) => revoke(e.preview));
    setEntries([]);
    setText("");
    setFormat("plaintext");
    setTitle("");
    setExpires("1d");
    setPassword("");
    setShareLink(undefined);
    setPhase("open");
  };

  const [copied, setCopied] = useState<"link" | "password">();
  const [copiedKey, setCopiedKey] = useState<string>();
  const copy = async (what: "link" | "password") => {
    const value = what === "link" ? shareLink : password;
    if (!value || copied === what) return;
    const label = what === "link" ? "Link" : "Password";
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? undefined : c)), 1500);
      toast.success(`${label} copied`);
    } catch {
      toast.error(
        `Copy failed — please copy the ${label.toLowerCase()} manually`,
      );
    }
  };
  const copyLink = () => copy("link");

  /* ---------- window listeners (bound once, read state through a ref) ---------- */
  const handlers = useRef<{
    paste: (e: ClipboardEvent) => void;
    drop: (files: File[]) => void;
    key: (e: KeyboardEvent) => void;
  }>(null!);
  handlers.current = {
    paste: (e) => {
      if (busy || !e.clipboardData) return;
      if (document.querySelector("[data-share-folder] dialog[open]")) return;
      const data = e.clipboardData;
      const pasted = Array.from(data.files);
      const pastedText = data.getData("text/plain");
      // Office apps put a rendered picture of the selection next to the
      // text; the text is what the user meant to paste.
      const isRichText =
        !!pastedText &&
        (data.types.includes("text/html") || data.types.includes("text/rtf"));
      if (pasted.length > 0 && !isRichText) {
        e.preventDefault();
        addFiles(pasted.map(renamePasted));
        return;
      }
      const target = e.target as HTMLElement | null;
      if (!pastedText || target?.closest("input, textarea")) return;
      e.preventDefault();
      if (!text) setFresh(new Set(["text"]));
      setText((prev) => (prev ? `${prev}\n${pastedText}` : pastedText));
      toast(text ? "Text appended" : "Text added");
    },
    drop: (files) => addFiles(files),
    key: (e) => {
      if (e.key === "Escape") setPop(null);
      if (
        e.key === "Enter" &&
        (e.metaKey || e.ctrlKey) &&
        !document.querySelector("[data-share-folder] dialog[open]")
      ) {
        e.preventDefault();
        seal();
      }
    },
  };

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer?.types.includes("Files");
    const onPaste = (e: ClipboardEvent) => handlers.current.paste(e);
    const onKey = (e: KeyboardEvent) => handlers.current.key(e);
    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      handlers.current.drop(Array.from(e.dataTransfer?.files ?? []));
    };
    // React listens on the document too, so stopPropagation in a popover
    // can't keep this from firing; ignore clicks inside popovers and their
    // triggers instead.
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target?.closest("[data-share-folder] :is([data-popover], [data-pop])")
      ) {
        setPop(null);
      }
    };

    document.addEventListener("paste", onPaste);
    document.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  /* ---------- render ---------- */
  type Card =
    { kind: "text"; key: string } | { kind: "file"; key: string; entry: Entry };
  const cards: Card[] = [
    ...(text ? [{ kind: "text" as const, key: "text" }] : []),
    ...entries.map((entry) => ({
      kind: "file" as const,
      key: entry.file.name + entry.file.size,
      entry,
    })),
  ];
  const n = cards.length;

  const imageCount = entries.filter((e) => e.preview).length;
  const otherCount = entries.length - imageCount;
  const summary = [
    text && "1 note",
    imageCount && `${imageCount} ${imageCount === 1 ? "image" : "images"}`,
    otherCount && `${otherCount} ${otherCount === 1 ? "file" : "files"}`,
  ].filter(Boolean);

  const togglePop = (p: Pop) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setPop((cur) => (cur === p ? null : p));
  };
  const url = shareLink ? new URL(shareLink) : undefined;

  // Same menu behind the + in the folder and the "Add content" button;
  // each opens next to its own trigger.
  const addMenu = (className: string) => (
    <div data-popover role="menu" className={cn(menu, "w-64", className)}>
      <button
        type="button"
        role="menuitem"
        className={menuItem}
        onClick={() => {
          setPop(null);
          openSheet();
        }}
      >
        <span className="flex items-center gap-2.5">
          <PenLineIcon className={menuIcon} />
          <span>
            {text ? "Edit text" : "Add text"}
            <small className={menuHint}>Type or paste in an editor</small>
          </span>
        </span>
      </button>
      <button
        type="button"
        role="menuitem"
        className={menuItem}
        onClick={() => {
          setPop(null);
          fileInput.current?.click();
        }}
      >
        <span className="flex items-center gap-2.5">
          <UploadIcon className={menuIcon} />
          <span>
            Add files
            <small className={menuHint}>
              Up to {MAX_FILE_COUNT} files, {MAX_TOTAL_SIZE_MB}MB total
            </small>
          </span>
        </span>
      </button>
    </div>
  );

  return (
    <DeskPage
      data-share-folder
      title={
        phase === "sent"
          ? "Your share link is ready"
          : "Share files and text securely"
      }
      subtitle={
        phase === "sent"
          ? "Only people with this link can open your content."
          : "Paste or drop files and text here. Once published, only people with the link can open them."
      }
    >
      <Folder
        sealing={busy}
        sealed={closed}
        drag={dragging && !busy}
        inside={
          <>
            {n === 0 && !busy && (
              <div className="absolute top-11 left-40 z-[6] grid w-[200px] justify-items-center gap-1 text-center text-[13px] text-white">
                <button
                  type="button"
                  aria-label="Add content"
                  aria-haspopup="menu"
                  aria-expanded={pop === "add"}
                  data-pop
                  onClick={togglePop("add")}
                  className="mb-1 grid size-8 cursor-pointer place-items-center rounded-full border-[1.5px] border-dashed border-white/80 text-white transition-[rotate,background-color,border-color] duration-250 hover:rotate-90 hover:border-solid hover:border-white hover:bg-white/20 aria-expanded:rotate-90 aria-expanded:border-solid aria-expanded:border-white aria-expanded:bg-white/20 [&_svg]:size-[15px]"
                >
                  <PlusIcon />
                </button>
                <span>Add files or text</span>
                <small className="text-[11.5px] text-white/80">
                  Drop, paste or click + to add
                </small>
                {pop === "add" &&
                  addMenu("top-[42px] left-1/2 -translate-x-1/2 text-left")}
              </div>
            )}

            <Sheets>
              {cards.map((card, k) => {
                const style = fanStyle(k, n);
                const className = cn(
                  fresh.has(card.key) && "animate-folder-drop",
                );
                // Corner actions: copy/download for images, then remove for
                // every card.
                const actions = (
                  <>
                    {card.kind === "file" && card.entry.preview && (
                      <>
                        <SheetAction
                          label={copiedKey === card.key ? "Copied" : "Copy image"}
                          done={copiedKey === card.key}
                          onClick={() => copyImageOf(card.key, card.entry.file)}
                        >
                          {copiedKey === card.key ? <CheckIcon /> : <CopyIcon />}
                        </SheetAction>
                        <SheetAction
                          label="Download"
                          onClick={() =>
                            download(card.entry.file, card.entry.file.name)
                          }
                        >
                          <DownloadIcon />
                        </SheetAction>
                      </>
                    )}
                    <SheetAction
                      label="Remove"
                      onClick={() => {
                        if (card.kind === "text") setText("");
                        else removeEntry(card.entry);
                      }}
                    >
                      <XIcon />
                    </SheetAction>
                  </>
                );
                if (card.kind === "text") {
                  return (
                    <SheetCard
                      key={card.key}
                      label="Edit text"
                      className={className}
                      style={style}
                      actions={actions}
                      onClick={() => !busy && openSheet()}
                    >
                      <NoteSheet text={text} format={format} />
                    </SheetCard>
                  );
                }
                const { entry } = card;
                return (
                  <SheetCard
                    key={card.key}
                    label={entry.file.name}
                    className={className}
                    style={style}
                    actions={actions}
                    onClick={() => {
                      if (entry.preview) {
                        setViewing(entry);
                        viewer.current?.showModal();
                      } else {
                        toast(
                          `${entry.file.name} · ${formatSize(entry.file.size)}`,
                        );
                      }
                    }}
                  >
                    {entry.preview ? (
                      <PhotoSheet src={entry.preview} name={entry.file.name} />
                    ) : (
                      <DocSheet
                        name={entry.file.name}
                        size={formatSize(entry.file.size)}
                      />
                    )}
                  </SheetCard>
                );
              })}
            </Sheets>
          </>
        }
        onFront={
          <>
            {phase !== "sent" && (
              <div className={cn(frontCard, "h-[70px] content-center")}>
                <input
                  id="folder-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy}
                  placeholder="Title (optional)"
                  aria-label="Title"
                  maxLength={100}
                  autoComplete="off"
                  className="w-full border-b border-[#dfe5ec] pb-0.5 text-lg/[1.4] font-semibold tracking-tight text-paper-foreground placeholder:text-[#aab5c2] focus:border-primary focus:outline-none"
                />
                <div className="mt-1.5 truncate font-mono text-[11.5px] text-paper-foreground-muted">
                  {summary.length
                    ? `${summary.join(" · ")}${totalSize ? ` · ${formatSize(totalSize)}` : ""}`
                    : "No files or text added"}
                </div>
              </div>
            )}

            {/* round sticker = expiry */}
            <Sticker
              burn={burnAfterRead}
              num={expNum}
              unit={expUnit}
              title="Expiration"
              data-pop
              onClick={togglePop("expiry")}
            />

            {/* password: an icon that widens in place into the field */}
            <label
              title="Password (optional) — never sent to the server"
              data-set={locked}
              data-bad={passwordInvalid}
              data-hide={closed && !locked}
              className="group/pw absolute top-[178px] right-[53px] z-[5] flex h-11 w-11 cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-white bg-[radial-gradient(circle_at_35%_28%,#ffffff,#eaf1fb_45%,#bfd3ee)] shadow-[0_3px_6px_rgba(10,30,70,.28),inset_0_-2px_3px_rgba(20,50,100,.16)] px-2.5 whitespace-nowrap text-folder-deep transition-[width,background-color,color,box-shadow] duration-300 ease-[cubic-bezier(.4,0,.2,1)] data-[hide=true]:hidden hover:w-[236px] hover:cursor-text hover:bg-white hover:bg-none hover:text-paper-foreground hover:shadow-[0_2px_6px_rgba(10,30,70,.22)] focus-within:w-[236px] focus-within:cursor-text focus-within:bg-white focus-within:bg-none focus-within:text-paper-foreground focus-within:shadow-[0_2px_6px_rgba(10,30,70,.22)] data-[bad=true]:w-[236px] data-[bad=true]:bg-white data-[bad=true]:bg-none data-[bad=true]:text-paper-foreground data-[set=true]:not-hover:not-focus-within:bg-band data-[set=true]:not-hover:not-focus-within:bg-[radial-gradient(circle_at_35%_28%,#56627a,#1c2433_58%,#0b0f17)] data-[set=true]:not-hover:not-focus-within:text-white data-[set=true]:not-hover:not-focus-within:shadow-[0_3px_6px_rgba(10,30,70,.32),inset_0_-2px_3px_rgba(0,0,0,.35)]"
            >
              <PasswordIcon className="size-6 shrink-0 group-focus-within/pw:text-primary group-hover/pw:text-primary" />
              <input
                ref={passwordInput}
                value={password}
                maxLength={12}
                disabled={busy && !closed}
                readOnly={closed}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (optional)"
                autoComplete="off"
                spellCheck={false}
                aria-label="Password (optional)"
                aria-invalid={passwordInvalid}
                className={cn(
                  revealOnOpen,
                  "min-w-0 flex-1 font-mono text-[13.5px] placeholder:font-sans placeholder:text-current/55 focus:outline-none",
                )}
              />
              {passwordInvalid && (
                <span className="shrink-0 text-[11.5px] text-destructive">
                  6–12 chars
                </span>
              )}
              {closed ? (
                // After publishing the password can't change; offer to copy it
                <button
                  type="button"
                  title={copied === "password" ? "Copied" : "Copy password"}
                  aria-label={
                    copied === "password" ? "Copied" : "Copy password"
                  }
                  aria-disabled={copied === "password"}
                  onClick={(e) => {
                    e.preventDefault();
                    copy("password");
                  }}
                  className={cn(
                    revealOnOpen,
                    "-mr-1 grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-full hover:bg-black/8 [&_svg]:size-3.5",
                    copied === "password" &&
                      "cursor-default text-key hover:bg-transparent",
                  )}
                >
                  {copied === "password" ? <CheckIcon /> : <CopyIcon />}
                </button>
              ) : (
                <button
                  type="button"
                  title="Generate"
                  aria-label="Generate a password"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    setPassword(generateId());
                  }}
                  className={cn(
                    revealOnOpen,
                    "-mr-1 grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-full hover:bg-black/8 [&_svg]:size-3.5",
                  )}
                >
                  <RotateCwIcon />
                </button>
              )}
            </label>

            {/* the link, on the same card the title was written on */}
            {phase === "sent" && url && (
              <div
                className={cn(
                  frontCard,
                  "top-[285px] h-auto -translate-y-1/2 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-3.5",
                )}
              >
                {/* left: title and link; right: QR code */}
                <div className="grid min-w-0 gap-y-1.5">
                  {title.trim() && (
                    <div className="truncate text-[15px]/[1.3] font-semibold tracking-tight text-paper-foreground">
                      {title.trim()}
                    </div>
                  )}
                  <div className="font-mono text-[11px]/[1.5] break-all text-paper-foreground">
                    {url.host}
                    {url.pathname}#
                    <span className="text-key">{url.hash.slice(1)}</span>
                    <CopyButton
                      label="Copy link"
                      copied={copied === "link"}
                      onClick={copyLink}
                      className="ml-1 align-[-2px]"
                    />
                  </div>
                </div>
                <span className="leading-none">
                  <QRCodeSVG value={shareLink!} size={68} level="M" />
                </span>
              </div>
            )}
          </>
        }
        outside={
          <>
            {pop === "expiry" && (
              <div
                data-popover
                role="menu"
                className={cn(menu, "top-0 right-0")}
              >
                <h4 className="mx-2.5 mt-1 mb-1.5 text-[11px] font-semibold tracking-[.06em] text-muted-foreground">
                  EXPIRES AFTER
                </h4>
                {EXPIRES.map(([value, , , label]) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={value === expires}
                    className={menuItem}
                    onClick={() => {
                      setExpires(value);
                      setPop(null);
                    }}
                  >
                    {label}
                    <CheckIcon
                      className={cn(
                        "size-3.5 text-primary",
                        value !== expires && "invisible",
                      )}
                    />
                  </button>
                ))}
                <div className="mx-1 my-1.5 h-px bg-border" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={burnAfterRead}
                  className={cn(menuItem, "text-destructive")}
                  onClick={() => {
                    setExpires(burnAfterRead ? "1d" : "b");
                    setPop(null);
                  }}
                >
                  <span>
                    Burn after reading
                    <small className={menuHint}>
                      Deleted the first time it&apos;s opened
                    </small>
                  </span>
                  <CheckIcon
                    className={cn(
                      "size-3.5 text-primary",
                      !burnAfterRead && "invisible",
                    )}
                  />
                </button>
              </div>
            )}
          </>
        }
      />

      {phase !== "sent" ? (
        <div className={buttonRow}>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={pop === "addBar"}
              data-pop
              disabled={busy}
              onClick={togglePop("addBar")}
              className={button}
            >
              <PlusIcon />
              Add content
            </button>
            {pop === "addBar" && addMenu("bottom-[calc(100%+8px)] left-0")}
          </div>
          <button
            type="button"
            disabled={!canSeal}
            aria-busy={busy}
            onClick={seal}
            className={cn(
              buttonPrimary,
              // In progress, not unavailable: stay black while publishing.
              "disabled:aria-busy:cursor-progress disabled:aria-busy:border-foreground disabled:aria-busy:bg-foreground disabled:aria-busy:text-background"
            )}
          >
            {busy ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      ) : (
        <div className={buttonRow}>
          <button
            type="button"
            onClick={copyLink}
            aria-disabled={copied === "link"}
            className={cn(buttonPrimary, copiedButton)}
          >
            {copied === "link" ? <CheckIcon /> : <CopyIcon />}
            {copied === "link" ? "Copied" : "Copy link"}
          </button>
          {!burnAfterRead && (
            <a
              href={shareLink}
              target="_blank"
              rel="noopener noreferrer"
              className={button}
            >
              <ExternalLinkIcon />
              Open link
            </a>
          )}
          <button type="button" onClick={reset} className={button}>
            <PlusIcon />
            New
          </button>
        </div>
      )}
      <p className={footnote}>
        {phase !== "sent" ? (
          <>
            Up to {MAX_FILE_COUNT} files, {MAX_TOTAL_SIZE_MB}MB total. Your
            content is encrypted in your browser — the server never sees it.
            The key is the part of the link after the{" "}
            <code className="font-mono text-xs text-key">#</code>.
          </>
        ) : burnAfterRead ? (
          <>
            This content is{" "}
            <b className="text-destructive">burned after reading</b>: it&apos;s
            deleted the first time it&apos;s opened — even by you.
          </>
        ) : (
          <>
            <b className={expiryText}>Expires in {expLabel}</b>
            {locked && " · password required to open"}
          </>
        )}
      </p>

      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <dialog
        ref={sheet}
        onClick={(e) => {
          if (e.target === sheet.current) sheet.current?.close();
        }}
        className={cn(dialog, "w-[min(760px,calc(100vw-32px))]")}
      >
        <div className={paperDialog}>
          <div className="mb-3 flex items-center justify-between">
            <b className="text-base font-semibold">
              {text ? "Edit text" : "Add text"}
            </b>
            <div className="flex items-center gap-1.5">
              <label className="relative">
                <select
                  aria-label="Text format"
                  value={draft.format}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, format: e.target.value }))
                  }
                  className="h-7 cursor-pointer appearance-none rounded-full bg-paper-muted pr-7 pl-3 font-mono text-xs hover:bg-[#e6ebf1] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {editorLanguages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-paper-foreground-muted" />
              </label>
              <button
                type="button"
                aria-label="Close"
                onClick={() => sheet.current?.close()}
                className={iconButton}
              >
                <XIcon />
              </button>
            </div>
          </div>
          <div
            ref={sheetInput}
            className="-mx-4 border-y border-[#e3e9f2]"
            onKeyDownCapture={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopPropagation();
                saveSheet();
              }
            }}
          >
            <Editor
              value={draft.text}
              language={draft.format}
              minHeight="252px"
              maxHeight="60vh"
              placeholder="Type or paste text or code…"
              onChange={(v) => setDraft((d) => ({ ...d, text: v }))}
            />
          </div>
          <div className="mt-3 flex items-center justify-between font-mono text-[11.5px] text-paper-foreground-muted">
            <span>
              {draft.text
                ? `${draft.text.split("\n").length} ${draft.text.split("\n").length === 1 ? "line" : "lines"} · ${draft.text.length} ${draft.text.length === 1 ? "char" : "chars"}`
                : "0 chars"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => sheet.current?.close()}
                className={sheetButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSheet}
                className={cn(
                  sheetButton,
                  "border-[#111a26] bg-[#111a26] text-white",
                )}
              >
                {text ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </dialog>

      <dialog
        ref={viewer}
        onClick={(e) => {
          if (e.target === viewer.current) viewer.current?.close();
        }}
        className={dialog}
      >
        {viewing?.preview && (
          <div className="animate-folder-sheet rounded-lg bg-paper p-2.5 text-paper-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]">
            <div className="mb-2.5 flex items-center justify-between gap-3 pl-1.5">
              <span className="truncate font-mono text-[11.5px] text-paper-foreground-muted">
                {viewing.file.name} · {formatSize(viewing.file.size)}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => viewer.current?.close()}
                className={iconButton}
              >
                <XIcon />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewing.preview}
              alt={viewing.file.name}
              className="block max-h-[70vh] w-full rounded-md bg-paper-muted object-contain"
            />
          </div>
        )}
      </dialog>
    </DeskPage>
  );
}

/* ---------- class lists ---------- */

// Password field parts that only show once the lock icon has opened up.
const revealOnOpen =
  "opacity-0 transition-opacity group-hover/pw:opacity-100 group-focus-within/pw:opacity-100 group-data-[bad=true]/pw:opacity-100";

const menu =
  "absolute z-40 min-w-[200px] animate-folder-pop rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-[0_18px_40px_-14px_rgba(10,20,40,.35)]";

const menuItem =
  "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[13.5px] hover:bg-accent";

const menuHint = "block text-[11.5px] text-muted-foreground";

const menuIcon = "size-[17px] shrink-0 text-muted-foreground";
