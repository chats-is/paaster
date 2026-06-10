import { del, put } from "@vercel/blob";

import { StorageProvider } from "./types";

export class VercelStorage implements StorageProvider {
  async upload(key: string, file: File, opts: { cacheMaxAge: number }) {
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: false,
      cacheControlMaxAge: opts.cacheMaxAge,
    });
    return blob.url;
  }

  async delete(url: string) {
    const pathname = new URL(url).pathname.slice(1);
    await del(pathname);
  }
}
