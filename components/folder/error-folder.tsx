"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import {
  buttonPrimary,
  buttonRow,
  DeskPage,
  Folder,
  frontCard,
} from "@/components/folder/folder-parts";
import { cn } from "@/lib/utils";

// An empty, open folder with a note on the front explaining what went wrong.
export function ErrorFolder({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <DeskPage title={title} subtitle={detail}>
      <Folder
        onFront={
          <div className={cn(frontCard, "h-[70px] content-center")}>
            <div className="border-b-[1.5px] border-dashed border-[#c6d0dc] pb-0.5 text-lg/[1.4] font-semibold tracking-tight text-paper-foreground">
              Nothing here
            </div>
            <div className="mt-1.5 truncate font-mono text-[11.5px] text-paper-foreground-muted">
              No files or text to show
            </div>
          </div>
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
