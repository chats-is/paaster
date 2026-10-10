"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import {
  buttonPrimary,
  buttonRow,
  DeskPage,
  Folder,
  frontCard,
  Sticker,
} from "@/components/folder/folder-parts";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = {
  404: "NOT FOUND",
  410: "GONE",
  ERR: "CAN'T OPEN",
};

// An empty, open folder with a note on the front explaining what went wrong;
// with a `status` (an HTTP status, or ERR when the content couldn't be opened
// at all), it's on the sticker where the expiry would be.
export function ErrorFolder({
  title,
  detail,
  status,
}: {
  title: string;
  detail: string;
  status?: number | "ERR";
}) {
  return (
    <DeskPage title={title} subtitle={detail}>
      <Folder
        onFront={
          <>
            <div className={cn(frontCard, "h-[70px] content-center")}>
              <div className="border-b border-[#dfe5ec] pb-0.5 text-lg/[1.4] font-semibold tracking-tight text-paper-foreground">
                Nothing here
              </div>
              <div className="mt-1.5 truncate font-mono text-[11.5px] text-paper-foreground-muted">
                No files or text to show
              </div>
            </div>
            {status && (
              <Sticker
                burn={false}
                num={status}
                unit=""
                label={STATUS[status] ?? "ERROR"}
                title={status === "ERR" ? "Couldn't open" : `Error ${status}`}
              />
            )}
          </>
        }
      />
      <div className={buttonRow}>
        <Link href="/" className={buttonPrimary}>
          <PlusIcon />
          Share something new
        </Link>
      </div>
    </DeskPage>
  );
}
