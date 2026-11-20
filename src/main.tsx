import "./index.css";

import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";

import { ErrorDesk } from "@/components/desk/error-desk";
import { ShareDesk } from "@/components/desk/share-desk";
import { ViewDesk } from "@/components/desk/view-desk";
import { NearbyProvider } from "@/components/nearby";
import { ThemeProvider } from "@/components/theme";
import { Toaster } from "@/components/ui/sonner";

const unavailable = {
  title: "This content isn't available",
  detail: "It doesn't exist, has expired, or was burned after reading.",
  status: 404 as const,
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <NearbyProvider>
        <div className="flex-1 p-1.5 sm:p-3">{children}</div>
      </NearbyProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Shell>
      <Routes>
        <Route path="/" element={<ShareDesk />} />
        <Route path="/:id" element={<ViewDesk />} />
        <Route path="*" element={<ErrorDesk {...unavailable} />} />
      </Routes>
    </Shell>
  </BrowserRouter>,
);
