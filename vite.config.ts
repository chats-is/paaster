import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

// Reuse the LAN certificate from `certificates/` when it is present, so phones
// on the same network get a secure context (Web Crypto) during development.
function devHttps() {
  const key = path.join(root, "certificates/dev-key.pem");
  const cert = path.join(root, "certificates/dev-cert.pem");
  if (!fs.existsSync(key) || !fs.existsSync(cert)) return undefined;
  return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: { "@": root },
  },
  server: {
    port: 3000,
    https: devHttps(),
  },
});
