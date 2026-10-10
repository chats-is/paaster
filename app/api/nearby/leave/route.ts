import { NextRequest } from "next/server";

import { isId, roomKey } from "@/lib/nearby-server";
import { redis } from "@/lib/redis";

// Sent with navigator.sendBeacon when a tab closes, so it drops off other
// devices' lists right away instead of after it times out.
export async function POST(req: NextRequest) {
  const id = await req.text();
  if (!isId(id)) return new Response("Invalid device", { status: 400 });
  await redis.hdel(roomKey(req), id);
  return new Response(null, { status: 204 });
}
