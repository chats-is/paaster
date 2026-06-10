"use client";

import { MonitorIcon, MoonIcon, PlusIcon, SunIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export default function Header() {
  // Theme toggle component
  const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) {
      return null;
    }

    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Theme: ${theme}`}
        title={`Theme: ${theme}`}
        className="rounded-full size-9 border border-border/60 bg-background/60 text-muted-foreground shadow-sm backdrop-blur-sm hover:bg-accent hover:text-accent-foreground hover:border-border transition-colors"
        onClick={() => {
          if (theme === "dark") setTheme("light");
          else if (theme === "light") setTheme("system");
          else setTheme("dark");
        }}
      >
        {theme === "dark" ? (
          <SunIcon className="size-[18px]" />
        ) : theme === "light" ? (
          <MoonIcon className="size-[18px]" />
        ) : (
          <MonitorIcon className="size-[18px]" />
        )}
      </Button>
    );
  };

  return (
    <header className="w-full border-b border-border/40 bg-background/70 backdrop-blur-xl sticky top-0 z-50 supports-[backdrop-filter]:bg-background/50">
      <div className="max-w-6xl mx-auto w-full flex h-14 items-center justify-between px-4 lg:px-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group"
        >
          <div className="relative">
            <Image
              src="/logo.svg"
              alt="Paaster logo"
              width={28}
              height={28}
              className="rounded-[8px] shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105 group-hover:rotate-3"
            />
          </div>
          <span className="brand-text font-bold text-xl tracking-tight">
            Paaster
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            asChild
            size="sm"
            className="flex gap-2 brand-gradient text-white border-0 rounded-full px-3 sm:px-4 shadow-sm shadow-sky-500/20 hover:opacity-90 hover:shadow-md hover:shadow-sky-500/30 transition-all"
          >
            <Link href="/">
              <PlusIcon className="size-4" />
              <span className="font-medium hidden sm:inline">New Paste</span>
            </Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
