"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import {
  buttonPrimary,
  buttonRow,
  Desk,
  DeskPage,
  ErrorSheet,
  fanStyle,
  frontCard,
  SheetCard,
  Sheets,
  Sticker,
} from "@/components/desk/desk-parts";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = {
  404: "NOT FOUND",
  410: "GONE",
  ERR: "CAN'T OPEN",
};

// The desk with a single error sheet on it and a note in front explaining
// what went wrong; with a `status` (an HTTP status, or ERR when the content
// couldn't be opened at all), the sheet names it and the sticker, where the
// expiry would be, shows just the status.
export function ErrorDesk({
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
      <Desk
        inside={
          <Sheets>
            <SheetCard
              label="Content unavailable"
              disabled
              // just shows the status: no hover lift
              className="pointer-events-none animate-sheet-rise"
              style={fanStyle(0, 1)}
              onClick={() => {}}
            >
              <ErrorSheet
                code={status ? String(status) : "ERROR"}
                note={(status && STATUS[status]) || "CAN'T SHOW"}
              />
            </SheetCard>
          </Sheets>
        }
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
                label=""
                title={status === "ERR" ? "Couldn't open" : `Error ${status}`}
              />
            )}
          </>
        }
      />
      <div className={buttonRow}>
        <Link href="/" className={buttonPrimary}>
          <PlusIcon />
          New
        </Link>
      </div>
    </DeskPage>
  );
}
