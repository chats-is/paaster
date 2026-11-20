// Same-network grouping for nearby sharing. On a Worker the edge has already
// authenticated CF-Connecting-IP, so that header is the visitor address.
// Wrangler dev has no edge address; those requests share one group.

function clientIp(req: Request) {
  return (req.headers.get("cf-connecting-ip") ?? "")
    .trim()
    .replace(/^::ffff:/, "");
}

function isPrivate(ip: string) {
  if (!ip || ip === "::1") return true;
  if (
    /^(127|10)\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  ) {
    return true;
  }
  return /^f[cd]|^fe80/i.test(ip);
}

// The /64 prefix of an IPv6 address, written out in full so the same network
// always hashes the same however the address was shortened.
function prefix64(ip: string) {
  const [head, tail = ""] = ip.split("::");
  const front = head ? head.split(":") : [];
  const back = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...front, ...Array(8 - front.length - back.length).fill("0"), ...back]
    : front;
  return groups
    .slice(0, 4)
    .map((group) => parseInt(group || "0", 16).toString(16))
    .join(":");
}

function networkOf(ip: string) {
  if (isPrivate(ip)) return "local";
  if (ip.includes(":")) return prefix64(ip);
  return ip;
}

export async function networkId(req: Request) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(networkOf(clientIp(req))),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
