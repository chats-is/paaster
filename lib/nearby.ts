// Sending links to nearby devices: other browsers with Paaster open on the
// same network. Each tab makes an ECDH key pair and lists its public key with
// the server; a link is encrypted to the receiving tab's key before it's
// sent, so the server only ever relays ciphertext — the key after the # stays
// out of its reach, as it does everywhere else.

export interface NearbyDevice {
  id: string; // this tab
  browser: string; // this browser, shared by its tabs
  kind: string; // "Mac · Chrome"
  key: string; // ECDH public key, base64
  visible: boolean;
  seen: number;
}

export type NearbyPeer = Pick<NearbyDevice, "id" | "kind" | "key">;

export interface NearbyEnvelope {
  from: string;
  key: string; // the sender's public key
  iv: string;
  data: string;
}

export interface NearbyMessage {
  url: string;
  title?: string;
  kind: string; // the sender
}

export interface NearbySelf {
  id: string;
  browser: string;
  kind: string;
  key: string;
  privateKey: CryptoKey;
}

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const randomId = () =>
  toBase64(crypto.getRandomValues(new Uint8Array(12)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function kindOf() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPod/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /Mac/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /CrOS/.test(ua)
              ? "Chromebook"
              : /Linux/.test(ua)
                ? "Linux"
                : "Device";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : "Browser";
  return `${os} · ${browser}`;
}

export const isNearbySupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!crypto?.subtle &&
  typeof navigator.sendBeacon === "function";

export async function createSelf(): Promise<NearbySelf> {
  let browser: string | null = null;
  try {
    browser = localStorage.getItem("paaster:nearby");
    if (!browser) {
      browser = randomId();
      localStorage.setItem("paaster:nearby", browser);
    }
  } catch {
    browser ??= randomId();
  }

  const keys = await crypto.subtle.generateKey(ECDH, false, ["deriveKey"]);
  const key = toBase64(await crypto.subtle.exportKey("raw", keys.publicKey));
  return {
    id: randomId(),
    browser,
    kind: kindOf(),
    key,
    privateKey: keys.privateKey,
  };
}

async function sharedKey(privateKey: CryptoKey, publicKey: string) {
  const theirs = await crypto.subtle.importKey(
    "raw",
    fromBase64(publicKey),
    ECDH,
    false,
    [],
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirs },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealMessage(
  self: NearbySelf,
  to: NearbyPeer,
  message: NearbyMessage,
): Promise<NearbyEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await sharedKey(self.privateKey, to.key),
    new TextEncoder().encode(JSON.stringify(message)),
  );
  return {
    from: self.id,
    key: self.key,
    iv: toBase64(iv),
    data: toBase64(data),
  };
}

export async function openMessage(
  self: NearbySelf,
  envelope: NearbyEnvelope,
): Promise<NearbyMessage> {
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    await sharedKey(self.privateKey, envelope.key),
    fromBase64(envelope.data),
  );
  return JSON.parse(new TextDecoder().decode(data));
}
