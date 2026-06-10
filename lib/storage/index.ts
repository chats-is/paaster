import { R2Storage } from "./r2";
import { StorageProvider } from "./types";
import { VercelStorage } from "./vercel";

function createStorage(): StorageProvider {
  switch (process.env.STORAGE_PROVIDER) {
    case "r2":
      return new R2Storage();
    default:
      return new VercelStorage();
  }
}

export const storage = createStorage();
