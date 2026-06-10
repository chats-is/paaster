"use client";

const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateFragment(key: Uint8Array, iv: Uint8Array): string {
  const fragmentData = [...key, ...iv];
  const bytes = new Uint8Array(fragmentData);

  let num = BigInt(0);
  for (const b of bytes) {
    num = (num << 8n) + BigInt(b);
  }

  let fragment = "";
  while (num > 0n) {
    fragment = CHARS[Number(num % 62n)] + fragment;
    num = num / 62n;
  }

  fragment = fragment.padStart(38, "0");
  return fragment;
}

export function decodeFragment(fragment: string): {
  keyBytes: Uint8Array;
  iv: Uint8Array;
} {
  let num = BigInt(0);
  for (let i = fragment.length - 1, pow = 1n; i >= 0; i--, pow *= 62n) {
    num += BigInt(CHARS.indexOf(fragment[i])) * pow;
  }

  const bytes = [];
  while (num > 0) {
    bytes.push(Number(num % 256n));
    num = num / 256n;
  }
  bytes.reverse();

  const keyBytes = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);

  return {
    keyBytes: new Uint8Array(keyBytes),
    iv: new Uint8Array(iv),
  };
}

function generateIv(iv: Uint8Array, password?: string): Uint8Array {
  if (!password) {
    return iv;
  }

  const passwordBytes = new TextEncoder().encode(password);
  const passwordIv = new Uint8Array(iv.length);

  for (let i = 0; i < Math.min(passwordBytes.length, passwordIv.length); i++) {
    passwordIv[i] = passwordBytes[i];
  }

  for (let i = passwordBytes.length; i < passwordIv.length; i++) {
    passwordIv[i] = iv[i];
  }

  return passwordIv;
}

export async function encryptContent(
  text?: string,
  files?: File[],
  password?: string
) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 128 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawKeyBuffer = await crypto.subtle.exportKey("raw", key).catch(() => {
    throw new Error("Failed to export encryption key");
  });
  const rawKey = new Uint8Array(rawKeyBuffer);

  const originalIv = crypto.getRandomValues(new Uint8Array(12));
  const iv = generateIv(originalIv, password);

  let encryptedText: string | undefined;
  const encryptedFiles: Blob[] = [];

  if (text) {
    const data = new TextEncoder().encode(text);
    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)
    );
    encryptedText = btoa(String.fromCharCode(...encrypted));
  }

  if (files) {
    for (const file of files) {
      const data = await file.arrayBuffer();
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        data
      );
      encryptedFiles.push(new Blob([encrypted]));
    }
  }

  const fragment = generateFragment(rawKey, originalIv);

  return {
    fragment,
    encryptedText,
    encryptedFiles,
  };
}

export async function decryptContent<T extends string | Blob>(
  encryptedData: string | Blob,
  fragment: string,
  password?: string
): Promise<T> {
  const { keyBytes, iv: originalIv } = decodeFragment(fragment);
  const iv = generateIv(originalIv, password);

  const key = await crypto.subtle
    .importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ])
    .catch(() => {
      throw new Error("Failed to import encryption key");
    });

  let encryptedBytes: Uint8Array;

  if (typeof encryptedData === "string") {
    encryptedBytes = new Uint8Array(
      atob(encryptedData)
        .split("")
        .map((char) => char.charCodeAt(0))
    );
  } else {
    const arrayBuffer = await encryptedData.arrayBuffer();
    encryptedBytes = new Uint8Array(arrayBuffer);
  }

  const decrypted = await crypto.subtle
    .decrypt({ name: "AES-GCM", iv }, key, encryptedBytes)
    .catch(() => {
      throw new Error("Content decryption failed");
    });

  if (typeof encryptedData === "string") {
    return new TextDecoder().decode(decrypted) as T;
  } else {
    return new Blob([decrypted]) as T;
  }
}
