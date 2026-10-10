import { NextRequest, NextResponse } from "next/server";

import type { NearbyDevice, NearbyEnvelope } from "@/lib/nearby";
import {
  inboxKey,
  isOnline,
  MAX_DEVICES,
  parseDevice,
  ROOM_TTL,
  roomKey,
} from "@/lib/nearby-server";
import { redis } from "@/lib/redis";

// Check-in: lists this device on its network and hands over any links sent
// to it since the last check-in. With `list` (the send dialog is open) it
// also returns the other devices there; most check-ins only need the inbox,
// so they skip reading the whole list.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const me = parseDevice(body);
  if (!me) return new Response("Invalid device", { status: 400 });
  const list = body?.list === true;

  const room = roomKey(req);
  const [added, , inbox] = await redis
    .pipeline()
    .hset(room, { [me.id]: me })
    .expire(room, ROOM_TTL)
    .lpop<NearbyEnvelope[]>(inboxKey(me.id), 10)
    .exec<[number, number, NearbyEnvelope[] | null]>();

  // A device joining is when the list gets tidied and its size checked, so
  // tabs that went away without saying so can't fill it up.
  let devices: NearbyDevice[] | undefined;
  if (list || added > 0) {
    const all = await redis.hgetall<Record<string, NearbyDevice>>(room);
    const now = Date.now();
    const listed = Object.values(all ?? {});
    const stale = listed.filter((d) => !isOnline(d, now)).map((d) => d.id);
    devices = listed.filter((d) => isOnline(d, now));
    if (added > 0 && devices.length > MAX_DEVICES) {
      stale.push(me.id);
      devices = undefined;
    }
    if (stale.length > 0) await redis.hdel(room, ...stale);
    if (!devices) {
      return new Response("Too many devices on this network", {
        status: 429,
      });
    }
  }

  if (!list) return NextResponse.json({ inbox: inbox ?? [] });

  // One entry per browser (its other tabs aren't other devices): the tab
  // that's in front, or else the one seen last.
  const byBrowser = new Map<string, NearbyDevice>();
  for (const d of devices!) {
    if (d.browser === me.browser) continue;
    const cur = byBrowser.get(d.browser);
    if (
      !cur ||
      (d.visible && !cur.visible) ||
      (d.visible === cur.visible && d.seen > cur.seen)
    ) {
      byBrowser.set(d.browser, d);
    }
  }
  const peers = [...byBrowser.values()]
    .sort((a, b) => a.kind.localeCompare(b.kind))
    .map(({ id, kind, key }) => ({ id, kind, key }));

  return NextResponse.json({ devices: peers, inbox: inbox ?? [] });
}
