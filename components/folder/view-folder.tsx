"use client";

import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  LoaderCircleIcon,
  PlusIcon,
  QrCodeIcon,
  UnlockIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Editor } from "@/components/editor";
import { ErrorFolder } from "@/components/folder/error-folder";
import {
  button,
  buttonPrimary,
  buttonRow,
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
  SheetCard,
  Sheets,
  Sticker,
} from "@/components/folder/folder-parts";
import { PasswordIcon } from "@/components/icons/password-icon";
import { decryptContent } from "@/lib/crypto";
import { Content } from "@/lib/types";
import { cn, formatSize } from "@/lib/utils";

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

type Decrypted = { blob: Blob; url?: string };
// loading → locked (needs a password) → opening → open
type Phase = "loading" | "locked" | "open";

// Time left until `iso`, as the sticker's big number and unit.
function timeLeft(iso: string): [string, string] {
  const mins = Math.max(0, (new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 60) return [String(Math.max(1, Math.round(mins))), "min"];
  const hours = mins / 60;
  if (hours < 24) return [String(Math.round(hours)), "hr"];
  const days = Math.round(hours / 24);
  return [String(days), days === 1 ? "day" : "days"];
}

// One-line cards shrink to fit, become pills and centre on the sticker;
// two-line cards keep the fixed height and large radius of frontCard.
const pillCard = "top-[285px] -translate-y-1/2 rounded-full";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const textStats = (t: string) =>
  `${plural(t.split("\n").length, "line")} · ${plural(t.length, "char")}`;

// File extension for downloading the note in its format.
const TEXT_EXT: Record<string, string> = {
  plaintext: "txt",
  markdown: "md",
  python: "py",
  javascript: "js",
  typescript: "ts",
  rust: "rs",
  yaml: "yml",
};
const textExt = (format?: string) =>
  TEXT_EXT[format ?? "plaintext"] ?? format ?? "txt";

// Attachment sizes are stored in MB, rounded to two decimals, so anything
// under ~5 KB comes back as 0.
const storedSize = (mb: number) =>
  mb >= 0.01 ? formatSize(mb * 1024 * 1024) : "< 10 KB";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function ViewFolder() {
  const { id } = useParams<{ id: string }>();
  const [fragment, setFragment] = useState<string>();
  const [data, setData] = useState<Content>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<{ title: string; detail: string }>();
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [text, setText] = useState<string>();
  const [files, setFiles] = useState<(Decrypted | undefined)[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState<number>();
  const [viewing, setViewing] = useState<number>();
  const noteDialog = useRef<HTMLDialogElement>(null);
  const imageDialog = useRef<HTMLDialogElement>(null);
  const qrDialog = useRef<HTMLDialogElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) notFound();
    setFragment(hash);
    const made = urls.current;
    return () => made.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    if (data?.title) document.title = `${data.title} – Paaster`;
  }, [data]);

  // Text is decrypted first (it also proves the key/password is right); files
  // follow in the background and fill in their sheets as they arrive.
  const decrypt = useCallback(
    async (content: Content, key: string, pw?: string) => {
      const attachments = content.attachments ?? [];
      const fetchFile = async (i: number) => {
        const res = await fetch(attachments[i].data);
        return decryptContent<Blob>(await res.blob(), key, pw);
      };
      // Without text, the first file is what proves the key; keep it rather
      // than downloading it again below.
      let first: Blob | undefined;
      if (content.text) {
        setText(await decryptContent<string>(content.text, key, pw));
      } else if (attachments.length > 0) {
        first = await fetchFile(0);
      }
      setFiles(attachments.map(() => undefined));
      setPhase("open");

      attachments.forEach(async (att, i) => {
        try {
          const raw = i === 0 && first ? first : await fetchFile(i);
          const type = IMAGE_TYPES[fileExt(att.name)];
          const blob = type ? new Blob([raw], { type }) : raw;
          const url = type ? URL.createObjectURL(blob) : undefined;
          if (url) urls.current.push(url);
          setFiles((prev) => prev.map((f, j) => (j === i ? { blob, url } : f)));
        } catch {
          toast.error(`Couldn't decrypt ${att.name}`);
        }
      });
    },
    [],
  );

  useEffect(() => {
    if (!id || !fragment) return;
    (async () => {
      try {
        const res = await fetch(`/api/${id}`);
        if (!res.ok) {
          setError({
            title: "This content isn't available",
            detail:
              (await res.text()) ||
              "It may have expired or been burned after reading.",
          });
          return;
        }
        const content: Content = await res.json();
        setData(content);
        if (content.hasPassword) {
          setPhase("locked");
          return;
        }
        await decrypt(content, fragment);
      } catch {
        setError({
          title: "Couldn't open this content",
          detail:
            "The link may be incomplete. Make sure you copied all of it, including the part after #.",
        });
      }
    })();
  }, [id, fragment, decrypt]);

  const unlock = async () => {
    if (!data || !fragment || !password || unlocking) return;
    setUnlocking(true);
    try {
      await decrypt(data, fragment, password);
      toast.dismiss("wrong-password");
    } catch {
      setWrong(true);
      setTimeout(() => setWrong(false), 500);
      toast.error("Wrong password", { id: "wrong-password" });
    } finally {
      setUnlocking(false);
    }
  };

  if (error) return <ErrorFolder title={error.title} detail={error.detail} />;

  const attachments = data?.attachments ?? [];
  const open = phase === "open";
  const n = (text ? 1 : 0) + attachments.length;
  const burn = !!data?.burnAfterRead;
  const [num, unit] = data?.expiresAt ? timeLeft(data.expiresAt) : ["", ""];
  const imageCount = attachments.filter(
    (a) => IMAGE_TYPES[fileExt(a.name)],
  ).length;
  const otherCount = attachments.length - imageCount;
  const summary = [
    text && "1 note",
    imageCount && `${imageCount} ${imageCount === 1 ? "image" : "images"}`,
    otherCount && `${otherCount} ${otherCount === 1 ? "file" : "files"}`,
  ].filter(Boolean);
  const viewed = viewing !== undefined ? files[viewing] : undefined;
  const pageUrl = fragment ? `${window.location.origin}/${id}#${fragment}` : "";

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Text copied");
    } catch {
      toast.error("Copy failed — please copy the text manually");
    }
  };
  const downloadText = () =>
    text !== undefined &&
    download(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
      `${data?.title?.trim() || "text"}.${textExt(data?.format)}`,
    );
  const copyImageAt = async (i: number) => {
    const file = files[i];
    if (!file) return;
    try {
      await copyImage(file.blob);
      setCopiedImage(i);
      setTimeout(() => setCopiedImage(undefined), 1500);
      toast.success("Image copied");
    } catch {
      toast.error("This browser can't copy images — download it instead");
    }
  };
  const downloadAll = () =>
    files.forEach((f, i) => f && download(f.blob, attachments[i].name));

  return (
    <DeskPage
      title={
        phase === "locked"
          ? "This content is password protected"
          : "Someone shared this with you"
      }
      subtitle={
        phase === "loading" ? (
          "Decrypting in your browser…"
        ) : burn ? (
          <>
            This content was{" "}
            <b className="text-destructive">burned after reading</b> — it&apos;s
            already deleted from the server. Save what you need before you leave
            this page.
          </>
        ) : (
          <>
            {phase === "locked"
              ? "Your password never leaves your browser"
              : "Decrypted in your browser"}
            {data?.expiresAt && (
              <>
                {" · "}
                <b className={expiryText}>
                  Expires {formatDate(data.expiresAt)}
                </b>
              </>
            )}
          </>
        )
      }
    >
      <Folder
        sealed={!open}
        inside={
          open && (
            <Sheets>
              {text && (
                <SheetCard
                  label="Read text"
                  className="animate-folder-drop"
                  style={fanStyle(0, n)}
                  onClick={() => noteDialog.current?.showModal()}
                  actions={
                    <>
                      <SheetAction
                        label={copied ? "Copied" : "Copy text"}
                        onClick={copyText}
                      >
                        {copied ? <CheckIcon /> : <CopyIcon />}
                      </SheetAction>
                      <SheetAction label="Download text" onClick={downloadText}>
                        <DownloadIcon />
                      </SheetAction>
                    </>
                  }
                >
                  <NoteSheet text={text} format={data?.format ?? "plaintext"} />
                </SheetCard>
              )}
              {attachments.map((att, i) => {
                const k = i + (text ? 1 : 0);
                const file = files[i];
                const isImage = !!IMAGE_TYPES[fileExt(att.name)];
                return (
                  <SheetCard
                    key={`${att.name}-${i}`}
                    label={isImage ? `View ${att.name}` : `Download ${att.name}`}
                    className="animate-folder-drop"
                    style={fanStyle(k, n)}
                    disabled={!file}
                    onClick={() => {
                      if (!file) return;
                      if (isImage) {
                        setViewing(i);
                        imageDialog.current?.showModal();
                      } else {
                        download(file.blob, att.name);
                      }
                    }}
                    actions={
                      file && (
                        <>
                          {isImage && (
                            <SheetAction
                              label={copiedImage === i ? "Copied" : "Copy image"}
                              onClick={() => copyImageAt(i)}
                            >
                              {copiedImage === i ? <CheckIcon /> : <CopyIcon />}
                            </SheetAction>
                          )}
                          <SheetAction
                            label="Download"
                            onClick={() => download(file.blob, att.name)}
                          >
                            <DownloadIcon />
                          </SheetAction>
                        </>
                      )
                    }
                  >
                    {isImage ? (
                      <PhotoSheet src={file?.url} name={att.name} />
                    ) : (
                      <DocSheet name={att.name} size={storedSize(att.size)} />
                    )}
                  </SheetCard>
                );
              })}
            </Sheets>
          )
        }
        onFront={
          <>
            {phase === "locked" ? (
              <form
                className={cn(
                  frontCard,
                  pillCard,
                  "grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 pr-2 pl-5",
                  wrong && "animate-[folder-shake_.4s]",
                )}
                onSubmit={(e) => {
                  e.preventDefault();
                  unlock();
                }}
              >
                <label className="flex min-w-0 items-center gap-2">
                  <PasswordIcon className="size-6 shrink-0 text-paper-foreground-muted" />
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    aria-label="Password"
                    className="min-w-0 flex-1 font-mono text-base text-paper-foreground placeholder:font-sans placeholder:text-[#aab5c2] focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!password || unlocking}
                  className={cn(
                    buttonPrimary,
                    "h-9 px-3.5 text-[13px] [&_svg]:size-4",
                  )}
                >
                  {unlocking ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <UnlockIcon />
                  )}
                  Open
                </button>
              </form>
            ) : (
              <div
                className={cn(
                  frontCard,
                  open && data?.title
                    ? "h-[70px] content-center"
                    : cn(pillCard, "px-5 py-3")
                )}
              >
                {phase === "loading" ? (
                  <div className="flex items-center gap-2.5 text-paper-foreground-muted">
                    <LoaderCircleIcon className="size-5 animate-spin" />
                    <span className="text-[15px]">Decrypting…</span>
                  </div>
                ) : (
                  <>
                    {data?.title && (
                      <div className="truncate border-b-[1.5px] border-dashed border-[#c6d0dc] pb-0.5 text-lg/[1.4] font-semibold tracking-tight text-paper-foreground">
                        {data.title}
                      </div>
                    )}
                    <div
                      className={cn(
                        "truncate font-mono text-[11.5px] text-paper-foreground-muted",
                        data?.title && "mt-1.5",
                      )}
                    >
                      {summary.join(" · ")}
                    </div>
                  </>
                )}
              </div>
            )}
            {data && (burn || data.expiresAt) && (
              <Sticker
                burn={burn}
                num={num}
                unit={unit}
                title={
                  burn
                    ? "Burned after reading"
                    : `Expires ${formatDate(data.expiresAt!)}`
                }
                tabIndex={-1}
              />
            )}
          </>
        }
      />

      {open && (
        <div className={buttonRow}>
          {text && (
            <button type="button" onClick={copyText} className={buttonPrimary}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy text"}
            </button>
          )}
          {attachments.length > 0 && (
            <button
              type="button"
              onClick={downloadAll}
              disabled={files.some((f) => !f)}
              className={text ? button : buttonPrimary}
            >
              <DownloadIcon />
              {attachments.length === 1 ? "Download file" : "Download all"}
            </button>
          )}
          {!burn && (
            <button
              type="button"
              onClick={() => qrDialog.current?.showModal()}
              className={button}
            >
              <QrCodeIcon />
              QR code
            </button>
          )}
          <Link href="/" className={button}>
            <PlusIcon />
            New
          </Link>
        </div>
      )}
      {phase !== "loading" && (
        <p className={footnote}>
          {phase === "locked"
            ? "Enter the password you were given to open it."
            : "Click a note to read it, or a file to download it."}
        </p>
      )}

      <dialog
        ref={noteDialog}
        onClick={(e) => {
          if (e.target === noteDialog.current) noteDialog.current?.close();
        }}
        className={cn(dialog, "w-[min(760px,calc(100vw-32px))]")}
      >
        <div className={paperDialog}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <b className="truncate text-base font-semibold">
              {data?.title || "Text"}
            </b>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="flex h-7 items-center rounded-full bg-paper-muted px-3 font-mono text-xs text-paper-foreground-muted">
                {data?.format || "plaintext"}
              </span>
              <button
                type="button"
                aria-label={copied ? "Copied" : "Copy text"}
                onClick={copyText}
                className={iconButton}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={() => noteDialog.current?.close()}
                className={iconButton}
              >
                <XIcon />
              </button>
            </div>
          </div>
          {text !== undefined && (
            <>
              <div className="-mx-4 border-y border-[#e3e9f2]">
                <Editor
                      language={data?.format}
                  value={text}
                  readOnly
                  minHeight="0"
                  maxHeight="70vh"
                />
              </div>
              <div className="mt-3 font-mono text-[11.5px] text-paper-foreground-muted">
                {textStats(text)}
              </div>
            </>
          )}
        </div>
      </dialog>

      <dialog
        ref={imageDialog}
        onClick={(e) => {
          if (e.target === imageDialog.current) imageDialog.current?.close();
        }}
        className={dialog}
      >
        {viewing !== undefined && viewed?.url && (
          <div className="animate-folder-sheet rounded-lg bg-paper p-2.5 text-paper-foreground shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)]">
            <div className="mb-2.5 flex items-center justify-between gap-3 pl-1.5">
              <span className="truncate font-mono text-[11.5px] text-paper-foreground-muted">
                {attachments[viewing].name} · {formatSize(viewed.blob.size)}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Download"
                  title="Download"
                  onClick={() =>
                    download(viewed.blob, attachments[viewing].name)
                  }
                  className={iconButton}
                >
                  <DownloadIcon />
                </button>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => imageDialog.current?.close()}
                  className={iconButton}
                >
                  <XIcon />
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewed.url}
              alt={attachments[viewing].name}
              className="block max-h-[70vh] w-full rounded-md bg-paper-muted object-contain"
            />
          </div>
        )}
      </dialog>
      {/* the same link, to open on a phone */}
      <dialog
        ref={qrDialog}
        onClick={(e) => {
          if (e.target === qrDialog.current) qrDialog.current?.close();
        }}
        className={cn(dialog, "w-[min(300px,calc(100vw-32px))]")}
      >
        <div className={paperDialog}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <b className="text-base font-semibold">Open on your phone</b>
            <button
              type="button"
              aria-label="Close"
              onClick={() => qrDialog.current?.close()}
              className={iconButton}
            >
              <XIcon />
            </button>
          </div>
          <div className="grid justify-items-center gap-3 pb-1">
            <span className="rounded-md bg-white p-2.5 leading-none">
              {/* the full link, key included */}
              <QRCodeSVG value={pageUrl} size={196} level="M" />
            </span>
            <p className="text-center text-[12.5px] text-paper-foreground-muted">
              Scan with your phone&apos;s camera to open this link
              {data?.hasPassword && " — the password is still needed"}.
            </p>
          </div>
        </div>
      </dialog>
    </DeskPage>
  );
}
