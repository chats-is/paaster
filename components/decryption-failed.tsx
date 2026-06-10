"use client";

import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";
import Link from "next/link";

export default function DecryptionFailed({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-card/80 backdrop-blur-sm p-8 sm:p-10 flex flex-col items-center justify-center text-center rounded-2xl shadow-sm border border-border/50">
        <div className="flex items-center justify-center size-16 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 mb-6">
          <ShieldAlertIcon className="size-8 text-rose-500" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">
          Decryption failed
        </h3>
        <p className="mt-2 text-sm text-muted-foreground break-words">
          {children}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-sky-600 dark:text-sky-300 hover:gap-3 transition-all"
        >
          <ArrowLeftIcon className="size-4" />
          Return Home
        </Link>
      </div>
    </div>
  );
}
