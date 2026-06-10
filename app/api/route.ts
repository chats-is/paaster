import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

import {
  MAX_FILE_COUNT,
  MAX_TOTAL_SIZE_BYTES,
  MAX_TOTAL_SIZE_MB,
} from "@/lib/config";
import { redis } from "@/lib/redis";
import { Attachment, Content } from "@/lib/types";
import { generateId, parseExpires } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const text = formData.get("text") as string | undefined;
  const title = formData.get("title") as string | undefined;
  const format = formData.get("format") as string | "plaintext";
  const attachmentData = formData.getAll("attachment_data") as File[];
  const attachmentNames = formData.getAll("attachment_name") as string[];
  const attachmentSizes = formData.getAll("attachment_size") as string[];
  const expires = formData.get("expires") as string;
  const hasPassword = formData.get("hasPassword") === "true";
  const burnAfterRead = expires === "b";

  const ttl = parseExpires(expires);
  if (!ttl && !burnAfterRead) {
    return new Response("Expires is invalid", { status: 400 });
  }

  let id = generateId();
  while (await redis.exists(`paaster:${id}`)) {
    id = generateId();
  }

  const attachments: Attachment[] = [];
  if (attachmentData.length > 0) {
    if (attachmentData.length > MAX_FILE_COUNT) {
      return new Response(`Too many files, max ${MAX_FILE_COUNT}`, {
        status: 400,
      });
    }

    const totalSize = attachmentData.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      return new Response(`Total size too large, max ${MAX_TOTAL_SIZE_MB}MB`, {
        status: 400,
      });
    }

    const uploadPath = process.env.UPLOAD_PATH || "paaster";

    for (let i = 0; i < attachmentData.length; i++) {
      const file = attachmentData[i];
      const name = attachmentNames[i];
      const size = attachmentSizes[i];

      if (!name || size === undefined) {
        continue;
      }

      const pathname = path.join(uploadPath, "encrypted", `${id}-${i}.bin`);
      const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
        cacheControlMaxAge: ttl || 3600,
      });

      attachments.push({
        data: blob.url,
        name,
        size: parseFloat(size),
      });
    }
  }

  const createdAt = new Date().toISOString();
  const expiresAt = ttl
    ? new Date(Date.now() + ttl * 1000).toISOString()
    : undefined;

  const content: Content = {
    id,
    title: title || undefined,
    format,
    expires,
    burnAfterRead,
    hasPassword,
    text: text || undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    createdAt: createdAt,
    expiresAt: expiresAt,
  };

  if (!burnAfterRead && expiresAt && attachments.length > 0) {
    const [first, ...rest] = attachments.map((attachment) => ({
      score: new Date(expiresAt).getTime(),
      member: attachment.data,
    }));
    await redis.zadd("paaster:files", first, ...rest);
  }

  await redis.set(`paaster:${id}`, content, ttl ? { ex: ttl } : {});

  return NextResponse.json(content);
}
