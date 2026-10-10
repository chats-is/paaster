import { createHash } from "crypto";
import { NextRequest } from "next/server";

import type { NearbyDevice, NearbyEnvelope } from "@/lib/nearby";

// Devices behind the same router reach the server from the same public IP
// (or, over IPv6, the same /64 prefix); that is what counts as "the same
// network". Requests from private addresses come from the server's own LAN
// (a self-hosted or `pnpm dev --hostname 0.0.0.0` setup) and share one group.
function networkOf(req: NextRequest) {
  const ip = (
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    ""
  )
    .trim()
    .replace(/^::ffff:/, "");

  let network = ip;
  if (
    !ip ||
    ip === "::1" ||
    /^(127|10)\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd]|^fe80/i.test(ip)
  ) {
    network = "local";
  } else if (ip.includes(":")) {
    network = ip.split(":").slice(0, 4).join(":");
  }
  // Only a hash of the network is stored, never the address itself.
  return createHash("sha256").update(network).digest("hex").slice(0, 24);
}

export const roomKey = (req: NextRequest) =>
  `paaster:nearby:${networkOf(req)}`;
export const inboxKey = (id: string) => `paaster:nearby:inbox:${id}`;
export const rateKey = (id: string) => `paaster:nearby:rate:${id}`;

// How long a device stays listed after its last check-in. Hidden tabs check
// in every 30s, but Chrome holds timers in tabs hidden for 5+ minutes to
// once a minute, so they get well over that.
const ONLINE_MS = { visible: 15_000, hidden: 90_000 };
export const ROOM_TTL = 120;
// Long enough for a hidden tab to come round and collect its links.
export const INBOX_TTL = 300;

// Limits against filling a network's list or flooding its devices.
export const MAX_DEVICES = 30;
export const MAX_SENDS_PER_MINUTE = 10;

export const isOnline = (d: NearbyDevice, now = Date.now()) =>
  now - d.seen < (d.visible ? ONLINE_MS.visible : ONLINE_MS.hidden);

export const isId = (v: unknown): v is string =>
  typeof v === "string" && /^[\w-]{8,40}$/.test(v);

export function parseDevice(body: unknown): NearbyDevice | undefined {
  const b = body as Partial<NearbyDevice> | null;
  if (
    !b ||
    !isId(b.id) ||
    !isId(b.browser) ||
    typeof b.kind !== "string" ||
    typeof b.key !== "string" ||
    b.kind.length > 40 ||
    b.key.length > 200
  ) {
    return;
  }
  return {
    id: b.id,
    browser: b.browser,
    kind: b.kind,
    key: b.key,
    visible: !!b.visible,
    seen: Date.now(),
  };
}

export function parseEnvelope(body: unknown): NearbyEnvelope | undefined {
  const b = body as Partial<NearbyEnvelope> | null;
  if (
    !b ||
    !isId(b.from) ||
    typeof b.key !== "string" ||
    typeof b.iv !== "string" ||
    typeof b.data !== "string" ||
    b.key.length > 200 ||
    b.iv.length > 40 ||
    b.data.length > 4096
  ) {
    return;
  }
  return { from: b.from, key: b.key, iv: b.iv, data: b.data };
}
