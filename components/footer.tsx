"use client";

import { GithubIcon, HeartIcon } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/50 backdrop-blur-md mt-auto">
      <div className="max-w-6xl mx-auto w-full px-4 lg:px-0 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left side - Copyright */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="brand-text font-semibold">Paaster</span>
              <span className="text-muted-foreground/70">© 2025</span>
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="flex items-center gap-1">
              Made with{" "}
              <HeartIcon className="size-3.5 fill-rose-500 text-rose-500 animate-pulse" />{" "}
              by AI
            </span>
          </div>

          {/* Right side - Links */}
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/copilot-is/paaster"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <GithubIcon className="size-4" />
              <span className="hidden sm:inline">GitHub</span>
            </Link>
            <div className="h-4 w-px bg-border/50" />
            <Link
              href="https://github.com/copilot-is/paaster/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              MIT License
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
