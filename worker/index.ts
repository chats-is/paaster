import type { Content } from "@/lib/types";
import { generateId, parseExpires } from "@/lib/utils";

import type { Bindings } from "./bindings";
import { isId, parseDevice, parseEnvelope } from "./nearby";
import { networkId } from "./network";
import { type CheckInResult, PaasterObject } from "./object";

// Burn-after-read content is deleted when it's first opened; this is how long
// it's kept if nobody ever does.
const BURN_MAX_AGE = 7 * 86400;

export { PaasterObject };

export default {
  async fetch(req: Request, env: Bindings): Promise<Response> {
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith("/api")) return await api(req, env, url);
    } catch (err) {
      console.error(err);
      return text("Something went wrong — please try again", 500);
    }
    return env.ASSETS.fetch(req);
  },
};

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function limits(env: Bindings) {
  const count = positive(env.MAX_FILE_COUNT, 10);
  const mb = positive(env.MAX_TOTAL_SIZE_MB, 50);
  return { count, bytes: mb * 1024 * 1024, mb };
}

function publicBase(env: Bindings) {
  const url = env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  return url || undefined;
}

function positive(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stub(env: Bindings, name: string) {
  return env.PAASTER.get(
    env.PAASTER.idFromName(name),
  ) as DurableObjectStub<PaasterObject>;
}

async function api(req: Request, env: Bindings, url: URL) {
  if (req.method === "POST" && url.pathname === "/api") {
    return createPaste(req, env);
  }
  if (req.method === "POST" && url.pathname === "/api/nearby") {
    return nearbyCheckIn(req, env);
  }
  if (req.method === "POST" && url.pathname === "/api/nearby/send") {
    return nearbySend(req, env);
  }
  if (req.method === "POST" && url.pathname === "/api/nearby/leave") {
    return nearbyLeave(req, env);
  }
  if (req.method === "GET" && /^\/api\/[0-9A-Za-z]{6}$/.test(url.pathname)) {
    return readPaste(env, url.pathname.slice("/api/".length));
  }
  return text("Not found", 404);
}

async function createPaste(req: Request, env: Bindings) {
  const form = await req.formData();
  const textField = form.get("text");
  const titleField = form.get("title");
  const formatField = form.get("format");
  const expiresField = form.get("expires");
  const expires = typeof expiresField === "string" ? expiresField : "";
  const hasPassword = form.get("hasPassword") === "true";
  const burnAfterRead = expires === "b";
  const title = typeof titleField === "string" ? titleField : "";
  const format = typeof formatField === "string" ? formatField : "";
  if (title.length > 100) return text("Title is too long", 400);
  if (format.length > 32) return text("Format is invalid", 400);
  const ttl = parseExpires(expires);
  if (!ttl && !burnAfterRead) return text("Expires is invalid", 400);

  const maxAge = ttl ?? BURN_MAX_AGE;
  const files = form
    .getAll("attachment_data")
    .filter((entry): entry is File => entry instanceof File);
  const names = form.getAll("attachment_name");
  const sizes = form.getAll("attachment_size");
  const { count, bytes, mb } = limits(env);

  if (files.length > count) return text(`Too many files, max ${count}`, 400);
  if (files.reduce((sum, file) => sum + file.size, 0) > bytes) {
    return text(`Total size too large, max ${mb}MB`, 400);
  }
  if (names.some((name) => typeof name === "string" && name.length > 512)) {
    return text("File name is too long", 400);
  }

  let id = generateId();
  while (await stub(env, id).exists()) id = generateId();

  const attachments: Content["attachments"] = [];
  const fileKeys: string[] = [];
  if (files.length > 0) {
    const base = publicBase(env);
    if (!base) {
      console.error("Missing R2_PUBLIC_URL");
      return text("Uploading files failed — please try again", 500);
    }
    try {
      for (let i = 0; i < files.length; i++) {
        const name = names[i];
        const size = sizes[i];
        if (typeof name !== "string" || !name || size === undefined) continue;
        const key = `encrypted/${id}-${i}.bin`;
        await env.FILES.put(key, files[i].stream(), {
          httpMetadata: {
            contentType: "application/octet-stream",
            cacheControl: `public, max-age=${ttl || 3600}`,
          },
        });
        fileKeys.push(key);
        attachments.push({
          data: `${base}/${key}`,
          name,
          size: Number.parseFloat(String(size)),
        });
      }
    } catch (err) {
      console.error(err);
      await Promise.all(fileKeys.map((key) => env.FILES.delete(key).catch(() => {})));
      return text("Uploading files failed — please try again", 500);
    }
  }

  const content: Content = {
    id,
    title: title || undefined,
    format: format || (null as unknown as string),
    expires,
    burnAfterRead,
    hasPassword,
    text: typeof textField === "string" ? textField || undefined : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
    createdAt: new Date().toISOString(),
    expiresAt: ttl ? new Date(Date.now() + ttl * 1000).toISOString() : undefined,
  };

  try {
    await stub(env, id).save(content, fileKeys, Date.now() + maxAge * 1000);
  } catch (err) {
    console.error(err);
    await Promise.all(fileKeys.map((key) => env.FILES.delete(key).catch(() => {})));
    return text("Uploading files failed — please try again", 500);
  }
  return Response.json(content);
}

async function readPaste(env: Bindings, id: string) {
  const result = await stub(env, id).read();
  if (result.status === 404) {
    return text("Content not found or has expired", 404);
  }
  return Response.json(result.content);
}

async function nearbyCheckIn(req: Request, env: Bindings) {
  const body = await req.json().catch(() => null);
  const me = parseDevice(body);
  if (!me) return text("Invalid device", 400);
  const result: CheckInResult = await stub(env, await networkId(req)).checkIn(
    me,
    (body as { list?: unknown }).list === true,
  );
  if (result.status === 429) {
    return text("Too many devices on this network", 429);
  }
  return json(
    result.devices ? { devices: result.devices, inbox: result.inbox } : { inbox: result.inbox },
  );
}

async function nearbySend(req: Request, env: Bindings) {
  const body = await req.json().catch(() => null);
  const envelope = parseEnvelope(
    (body as { envelope?: unknown } | null)?.envelope,
  );
  const to = (body as { to?: unknown } | null)?.to;
  if (!envelope || !isId(to)) return text("Invalid message", 400);
  const result = await stub(env, await networkId(req)).send(
    envelope.from,
    to,
    envelope,
  );
  if (result === "missing") return text("That device is no longer nearby", 404);
  if (result === "limited") {
    return text("Too many links sent — try again in a minute", 429);
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

async function nearbyLeave(req: Request, env: Bindings) {
  const id = await req.text();
  if (!isId(id)) return text("Invalid device", 400);
  await stub(env, await networkId(req)).leave(id);
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
