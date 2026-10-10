import { NextRequest } from "next/server";

import type { NearbyDevice } from "@/lib/nearby";
import {
  INBOX_TTL,
  inboxKey,
  isId,
  isOnline,
  MAX_SENDS_PER_MINUTE,
  parseEnvelope,
  rateKey,
  roomKey,
} from "@/lib/nearby-server";
import { redis } from "@/lib/redis";

// Drops an encrypted link into another device's inbox. Both devices have to
// be checked in on the same network, so links can't be pushed to devices
// elsewhere.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const envelope = parseEnvelope(body?.envelope);
  const to = body?.to;
  if (!envelope || !isId(to)) {
    return new Response("Invalid message", { status: 400 });
  }

  const listed = await redis.hmget<Record<string, NearbyDevice | null>>(
    roomKey(req),
    envelope.from,
    to,
  );
  const from = listed?.[envelope.from];
  const target = listed?.[to];
  if (!from || !target || !isOnline(target)) {
    return new Response("That device is no longer nearby", { status: 404 });
  }

  const rate = rateKey(envelope.from);
  const sent = await redis.incr(rate);
  if (sent === 1) await redis.expire(rate, 60);
  if (sent > MAX_SENDS_PER_MINUTE) {
    return new Response("Too many links sent — try again in a minute", {
      status: 429,
    });
  }

  const inbox = inboxKey(to);
  await redis
    .pipeline()
    .rpush(inbox, envelope)
    .ltrim(inbox, -20, -1)
    .expire(inbox, INBOX_TTL)
    .exec();

  return new Response(null, { status: 204 });
}
