import { createHash } from "crypto";
import { BlockList, isIP } from "net";
import { NextRequest } from "next/server";

import type { NearbyDevice, NearbyEnvelope } from "@/lib/nearby";

// Cloudflare's address ranges (https://www.cloudflare.com/ips/).
const CLOUDFLARE = new BlockList();
for (const range of [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
  "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
  "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
  "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
]) {
  const [net, bits] = range.split("/");
  CLOUDFLARE.addSubnet(net, Number(bits), net.includes(":") ? "ipv6" : "ipv4");
}

const clean = (ip?: string | null) => (ip ?? "").trim().replace(/^::ffff:/, "");

// The visitor's address. Behind Cloudflare, the platform only sees
// Cloudflare's edge, which changes from request to request; the visitor's
// own address is then in CF-Connecting-IP. That header is trusted only on
// requests that really come from Cloudflare, since anyone reaching the
// server directly could set it.
function clientIp(req: NextRequest) {
  const peer = clean(
    req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0],
  );
  const visitor = clean(req.headers.get("cf-connecting-ip"));
  const version = isIP(peer);
  if (
    isIP(visitor) &&
    version &&
    CLOUDFLARE.check(peer, version === 4 ? "ipv4" : "ipv6")
  ) {
    return visitor;
  }
  return peer;
}

// The /64 prefix of an IPv6 address, written out in full so that the same
// network always comes out the same however the address was shortened.
function prefix64(ip: string) {
  const [head, tail = ""] = ip.split("::");
  const front = head ? head.split(":") : [];
  const back = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...front, ...Array(8 - front.length - back.length).fill("0"), ...back]
    : front;
  return groups
    .slice(0, 4)
    .map((g) => parseInt(g || "0", 16).toString(16))
    .join(":");
}

// Devices behind the same router reach the server from the same public IP
// (or, over IPv6, the same /64 prefix); that is what counts as "the same
// network". Requests from private addresses come from the server's own LAN
// (a self-hosted or `pnpm dev --hostname 0.0.0.0` setup) and share one group.
function networkOf(req: NextRequest) {
  const ip = clientIp(req);

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
    network = prefix64(ip);
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
