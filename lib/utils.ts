import { type ClassValue, clsx } from "clsx";
import { customAlphabet } from "nanoid";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const generateId = customAlphabet(alphabet, 6);

export function parseExpires(expires?: string) {
  if (!expires || expires === "b") {
    return;
  }

  const match = expires.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    throw new Error("Invalid expiration format");
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "m" && ![10, 30].includes(value)) {
    throw new Error("Invalid minutes value");
  }

  if (unit === "h" && ![1, 6, 12].includes(value)) {
    throw new Error("Invalid hours value");
  }

  if (unit === "d" && ![1, 3, 7].includes(value)) {
    throw new Error("Invalid days value");
  }

  if (unit === "m") {
    return value * 60;
  }

  if (unit === "h") {
    return value * 3600;
  }

  if (unit === "d") {
    return value * 86400;
  }

  throw new Error("Invalid expiration unit");
}

export const editorLanguages = [
  "plaintext",
  "markdown",
  "python",
  "javascript",
  "typescript",
  "java",
  "sql",
  "html",
  "css",
  "c",
  "cpp",
  "go",
  "php",
  "rust",
  "json",
  "yaml",
  "xml",
];

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
