"use client";

import {
  ExternalLinkIcon,
  LoaderCircleIcon,
  LockIcon,
  PaperclipIcon,
  PlusIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";

import { Editor } from "@/components/editor";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_FILE_COUNT,
  MAX_TOTAL_SIZE_BYTES,
  MAX_TOTAL_SIZE_MB,
} from "@/lib/config";
import { encryptContent } from "@/lib/crypto";
import { editorLanguages, generateId } from "@/lib/utils";

export default function Page() {
  const { theme } = useTheme();
  const [title, setTitle] = useState<string>();
  const [format, setFormat] = useState("plaintext");
  const [text, setText] = useState<string>();
  const [files, setFiles] = useState<File[]>([]);
  const [expires, setExpires] = useState("1d");
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [password, setPassword] = useState<string>();
  const [shareLink, setShareLink] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [isOpenAlertDialog, setIsOpenAlertDialog] = useState(false);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (!text && files.length === 0) {
        toast.error("Publish failed");
        return;
      }

      if (files.length > MAX_FILE_COUNT) {
        toast.error(`Too many files, max ${MAX_FILE_COUNT}`);
        return;
      }

      if (
        files.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_SIZE_BYTES
      ) {
        toast.error(`Total size too large, max ${MAX_TOTAL_SIZE_MB}MB`);
        return;
      }

      if (password && (password.length < 6 || password.length > 12)) {
        toast.error("Password must be 6-12 characters");
        return;
      }

      const { fragment, encryptedText, encryptedFiles } = await encryptContent(
        text,
        files,
        password
      );

      const formData = new FormData();
      formData.append("expires", expires);

      if (title) {
        formData.append("title", title);
      }
      if (password) {
        formData.append("hasPassword", "true");
      }
      if (text && encryptedText) {
        formData.append("format", format);
        formData.append("text", encryptedText);
      }
      files.forEach((f, i) => {
        const encryptedFile = encryptedFiles[i];
        if (!encryptedFile) return;
        formData.append("attachment_data", encryptedFile, "encrypted.bin");
        formData.append("attachment_name", f.name);
        formData.append(
          "attachment_size",
          (f.size / (1024 * 1024)).toFixed(2)
        );
      });

      const res = await fetch("/api", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.text();
        toast.error(error);
        return;
      }

      const { id } = await res.json();
      const url = new URL(window.location.origin);
      setShareLink(`${url.toString()}${id}#${fragment}`);
      setIsOpenAlertDialog(true);
    } catch {
      toast.error("Publish failed");
    } finally {
      setSubmitting(false);
    }
  };

  const addFiles = (selected: FileList | null) => {
    if (!selected || selected.length === 0) return;

    const merged = [...files];
    for (const f of Array.from(selected)) {
      if (!merged.some((m) => m.name === f.name && m.size === f.size)) {
        merged.push(f);
      }
    }

    if (merged.length > MAX_FILE_COUNT) {
      toast.error(`Too many files, max ${MAX_FILE_COUNT}`);
      return;
    }

    const totalSize = merged.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      toast.error(`Total size too large, max ${MAX_TOTAL_SIZE_MB}MB`);
      return;
    }

    setFiles(merged);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="text-center py-6 sm:py-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-300 mb-4">
          <LockIcon className="size-3.5" />
          End-to-end encrypted in your browser
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Share text & files,{" "}
          <span className="brand-text">privately</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
          Your content is encrypted before it ever leaves your device. We never
          see the key — only people with your link can decrypt it.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-card p-4 sm:p-6 flex flex-col rounded-xl shadow-sm border border-border/50">
            <div className="mb-6">
              <Editor
                className="h-[32rem] rounded-md border border-border/50 overflow-hidden"
                theme={theme}
                language={format}
                value={text}
                onChange={(value: string) => setText(value)}
              />
            </div>
            <div className="space-y-3">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="p-3 border border-border/50 rounded-xl bg-muted/30 flex items-center justify-between gap-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-background rounded-full shadow-sm">
                      <PaperclipIcon className="size-5 text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-sm truncate">
                        {file.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 hover:bg-destructive/10 hover:text-destructive rounded-full shrink-0"
                    title="Remove file"
                    onClick={() => handleRemoveFile(index)}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              ))}
              <div
                className="p-3 border-2 border-dashed border-border/50 rounded-xl relative flex flex-col items-center justify-center gap-1 transition-colors hover:bg-muted/30 hover:border-primary/50"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  multiple
                  disabled={submitting}
                  onChange={handleFileChange}
                  className="w-full h-full absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="p-2 bg-muted/50 rounded-full">
                  <PlusIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="font-medium text-sm">
                  {files.length > 0
                    ? "Add more files"
                    : "Drop files here or click to upload"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Up to {MAX_FILE_COUNT} files, {MAX_TOTAL_SIZE_MB}MB total
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card p-4 sm:p-5 rounded-xl shadow-sm border border-border/50 space-y-5">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">
              Settings
            </h3>

            <div className="space-y-2">
              <Label className="text-xs font-medium" htmlFor="title">
                Title{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="title"
                type="text"
                disabled={submitting}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Format</Label>
              <Select
                defaultValue={format}
                onValueChange={(value) => setFormat(value)}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a format" />
                </SelectTrigger>
                <SelectContent>
                  {editorLanguages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Expires</Label>
              <Select
                value={expires}
                onValueChange={(value) => {
                  if (value === "b") {
                    setBurnAfterRead(true);
                  }
                  setExpires(value);
                }}
                disabled={burnAfterRead || submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="b">Burn after read</SelectItem>
                  <SelectItem value="10m">10 minutes</SelectItem>
                  <SelectItem value="30m">30 minutes</SelectItem>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="6h">6 hours</SelectItem>
                  <SelectItem value="12h">12 hours</SelectItem>
                  <SelectItem value="1d">1 day</SelectItem>
                  <SelectItem value="3d">3 days</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 mt-2">
                <Checkbox
                  id="burn_after_read"
                  checked={burnAfterRead}
                  disabled={submitting}
                  onCheckedChange={(checked) => {
                    setExpires(checked ? "b" : "1d");
                    setBurnAfterRead(checked ? true : false);
                  }}
                />
                <Label
                  htmlFor="burn_after_read"
                  className="text-xs cursor-pointer"
                >
                  Burn after read
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium" htmlFor="password">
                Password{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <div className="flex items-center">
                <Input
                  id="password"
                  minLength={4}
                  maxLength={12}
                  disabled={submitting}
                  value={password || ""}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-r-none"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={submitting}
                  onClick={() => setPassword(generateId())}
                  className="rounded-l-none border-l-0"
                >
                  <RotateCwIcon className="size-4" />
                </Button>
              </div>
              {password && (password.length < 6 || password.length > 12) && (
                <div className="text-destructive text-xs mt-1">
                  Password must be 6-12 characters
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || (!text && files.length === 0)}
                className="w-full brand-gradient text-white border-0 shadow-md shadow-sky-500/20 hover:opacity-90 hover:shadow-lg hover:shadow-sky-500/30 transition-all disabled:opacity-50"
                size="lg"
              >
                {submitting ? (
                  <>
                    <LoaderCircleIcon className="animate-spin mr-2 size-4" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <LockIcon className="size-4" />
                    Encrypt & Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={isOpenAlertDialog && !!shareLink}>
        <AlertDialogContent className="max-w-lg w-[calc(100%-2rem)] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">
              <Button
                variant="ghost"
                className="rounded-full size-6"
                onClick={() => {
                  setIsOpenAlertDialog(false);
                  window.location.reload();
                }}
              >
                <XIcon className="size-3.5 text-muted-foreground" />
              </Button>
            </AlertDialogTitle>
            <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 w-full mb-4">
              <div className="flex-1 grid w-full gap-3 order-2 sm:order-1">
                <Textarea
                  className="w-full h-20 text-sm"
                  value={shareLink}
                  readOnly
                />
                <div className="flex items-center gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      if (shareLink && navigator.clipboard) {
                        navigator.clipboard.writeText(shareLink);
                        toast.success("Link copied to clipboard", {
                          duration: 2000,
                        });
                      }
                    }}
                  >
                    Copy link
                  </Button>
                  {!burnAfterRead && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (shareLink) {
                          window.open(shareLink, "_blank", "noopener,noreferrer");
                        }
                      }}
                    >
                      <ExternalLinkIcon className="size-4" />
                      Open link
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-none order-1 sm:order-2">
                <QRCodeSVG
                  value={shareLink || ""}
                  size={120}
                  className="sm:w-32 sm:h-32"
                />
              </div>
            </div>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
