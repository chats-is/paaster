import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { NearbyProvider } from "@/components/nearby";
import { Toaster } from "@/components/ui/sonner";
import { deskLookScript } from "@/lib/desk-style";
import { stageScaleScript } from "@/lib/stage";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Paaster – Secure Text and File Sharing",
  description: "End-to-end encrypted text and file sharing platform",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: stageScaleScript }} />
        <script dangerouslySetInnerHTML={{ __html: deskLookScript }} />
      </head>
      <body
        className={cn(
          "h-full scroll-smooth antialiased flex flex-col",
          geistSans.variable,
          geistMono.variable
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NearbyProvider>
            <div className="flex-1 p-1.5 sm:p-3">{children}</div>
          </NearbyProvider>
          <Toaster position="top-center" richColors />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
