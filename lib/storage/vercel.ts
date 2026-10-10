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
    await del(url);
  }
}
