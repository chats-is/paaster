import { ArrowLeftIcon, FileQuestionIcon } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto w-full">
      <div className="bg-card/80 backdrop-blur-sm p-8 sm:p-10 flex flex-col items-center justify-center text-center rounded-2xl shadow-sm border border-border/50">
        <div className="flex items-center justify-center size-16 rounded-2xl brand-gradient shadow-lg shadow-sky-500/25 mb-6">
          <FileQuestionIcon className="size-8 text-white" />
        </div>
        <h1 className="brand-text text-5xl font-bold tracking-tight">404</h1>
        <h3 className="mt-3 text-xl font-semibold text-foreground">Not Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This content doesn&apos;t exist, was burned after reading, or has
          expired.
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
