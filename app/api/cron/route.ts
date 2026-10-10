import { NextRequest, NextResponse } from "next/server";

import { redis } from "@/lib/redis";
import { storage } from "@/lib/storage";

export const maxDuration = 60;

// Expired files are taken a batch at a time, deleted in parallel, and each
// batch's deleted files are struck off right away; the run stops early
// rather than time out, and the next run carries on where it left off.
const BATCH = 50;
const TIME_BUDGET_MS = 45_000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const start = Date.now();
  let deleted = 0;
  // Files that couldn't be deleted stay listed for the next run; they sort
  // first, so skip past them.
  let failed = 0;

  while (Date.now() - start < TIME_BUDGET_MS) {
    const expiredFiles: string[] = await redis.zrange(
      "paaster:files",
      0,
      start,
      { byScore: true, offset: failed, count: BATCH },
    );
    if (expiredFiles.length === 0) break;

    const results = await Promise.allSettled(
      expiredFiles.map((fileUrl) => storage.delete(fileUrl)),
    );
    const done = expiredFiles.filter((fileUrl, i) => {
      const result = results[i];
      if (result.status === "rejected") console.error(fileUrl, result.reason);
      return result.status === "fulfilled";
    });

    if (done.length > 0) await redis.zrem("paaster:files", ...done);
    deleted += done.length;
    failed += expiredFiles.length - done.length;
  }

  const remaining = await redis.zcount("paaster:files", 0, start);
  return NextResponse.json({ ok: true, deleted, failed, remaining });
}
