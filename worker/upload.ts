import { AwsClient } from "aws4fetch";

import type { Content } from "@/lib/types";
import { generateId, parseExpires } from "@/lib/utils";

import type { Bindings } from "./bindings";
import { PaasterObject } from "./object";

const BURN_MAX_AGE = 7 * 86400;
const TAG_BYTES = 16;

type FileSpec = { name: string; bytes: number; original: number };

export type Fields = {
  title?: string;
  format: string | null;
  expires: string;
  burnAfterRead: boolean;
  hasPassword: boolean;
  text?: string;
  ttl?: number;
  maxAge: number;
};

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function stub(env: Bindings, name: string) {
  return env.PAASTER.get(
    env.PAASTER.idFromName(name),
  ) as DurableObjectStub<PaasterObject>;
}

function limits(env: Bindings) {
  const count = positive(env.MAX_FILE_COUNT, 10);
  const mb = positive(env.MAX_TOTAL_SIZE_MB, 100);
  return { count, bytes: mb * 1024 * 1024, mb };
}

function positive(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function publicBase(env: Bindings) {
  const url = env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  return url || undefined;
}

function bucketName(env: Bindings) {
  const name = env.R2_BUCKET?.trim();
  return name || undefined;
}

async function readJson(req: Request) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function readExpires(body: Record<string, unknown> | undefined): Fields | Response {
  if (!body) return text("Expires is invalid", 400);
  const expires = typeof body.expires === "string" ? body.expires : "";
  let ttl: number | undefined;
  try {
    ttl = parseExpires(expires);
  } catch {
    return text("Expires is invalid", 400);
  }
  const burnAfterRead = expires === "b";
  if (!ttl && !burnAfterRead) return text("Expires is invalid", 400);
  return {
    format: null,
    expires,
    burnAfterRead,
    hasPassword: false,
    ttl,
    maxAge: ttl ?? BURN_MAX_AGE,
  };
}

export function readFiles(
  value: unknown,
  env: Bindings,
  names = true,
): FileSpec[] | Response {
  if (!Array.isArray(value)) {
    return text("Uploading files failed — please try again", 400);
  }
  const { count, bytes, mb } = limits(env);
  if (value.length > count) return text(`Too many files, max ${count}`, 400);
  const files: FileSpec[] = [];
  let total = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return text("Uploading files failed — please try again", 400);
    }
    const record = item as { name?: unknown; bytes?: unknown; original?: unknown };
    const { name, bytes, original } = record;
    if (names && (typeof name !== "string" || !name)) {
      return text("Uploading files failed — please try again", 400);
    }
    if (typeof name === "string" && name.length > 512) {
      return text("File name is too long", 400);
    }
    if (
      typeof bytes !== "number" ||
      typeof original !== "number" ||
      !Number.isInteger(bytes) ||
      !Number.isInteger(original) ||
      original < 0 ||
      bytes !== original + TAG_BYTES
    ) {
      return text("Uploading files failed — please try again", 400);
    }
    total += original;
    files.push({ name: typeof name === "string" ? name : "", bytes, original });
  }
  if (total > bytes) return text(`Total size too large, max ${mb}MB`, 400);
  return files;
}

export function filesFromForm(form: FormData, env: Bindings): FileSpec[] | Response {
  const names = form.getAll("attachment_name");
  const originals = form.getAll("attachment_original");
  if (names.length !== originals.length) {
    return text("Uploading files failed — please try again", 400);
  }
  return readFiles(
    names.map((name, i) => {
      const raw = originals[i];
      const original = typeof raw === "string" ? Number(raw) : Number.NaN;
      return {
        name: typeof name === "string" ? name : "",
        original,
        bytes: original + TAG_BYTES,
      };
    }),
    env,
  );
}

function keysFor(id: string, count: number) {
  return Array.from({ length: count }, (_, i) => `encrypted/${id}-${i}.bin`);
}

async function deleteKeys(env: Bindings, keys: string[]) {
  await Promise.all(keys.map((key) => env.FILES.delete(key).catch(() => {})));
}

function signer(env: Bindings) {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return undefined;
  }
  return new AwsClient({
    service: "s3",
    region: "auto",
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
}

async function presign(
  client: AwsClient,
  accountId: string,
  bucket: string,
  key: string,
  headers: Record<string, string>,
) {
  const signed = await client.sign(
    new Request(
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}?X-Amz-Expires=3600`,
      { method: "PUT", headers },
    ),
    { aws: { signQuery: true, allHeaders: true } },
  );
  return signed.url.toString();
}

export async function startUploads(req: Request, env: Bindings) {
  const body = await readJson(req);
  const fields = readExpires(body);
  if (fields instanceof Response) return fields;
  const files = readFiles(body?.files, env, false);
  if (files instanceof Response) return files;
  if (files.length === 0) {
    return text("Uploading files failed — please try again", 400);
  }
  const client = signer(env);
  const base = publicBase(env);
  const bucket = bucketName(env);
  if (!client || !base || !bucket || !env.R2_ACCOUNT_ID) {
    console.error("Missing R2 upload configuration");
    return text("Uploading files failed — please try again", 500);
  }

  let id = generateId();
  while (await stub(env, id).exists()) id = generateId();

  const cacheControl = `public, max-age=${fields.ttl || 3600}`;
  const uploads = [];
  for (let i = 0; i < files.length; i++) {
    const headers = {
      "content-type": "application/octet-stream",
      "cache-control": cacheControl,
      "content-length": String(files[i].bytes),
    };
    uploads.push({
      url: await presign(
        client,
        env.R2_ACCOUNT_ID,
        bucket,
        keysFor(id, files.length)[i],
        headers,
      ),
      headers: {
        "content-type": headers["content-type"],
        "cache-control": headers["cache-control"],
      },
    });
  }
  return Response.json(
    { id, uploads },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function saveUploads(
  env: Bindings,
  id: string,
  fields: Fields,
  files: FileSpec[],
) {
  if (!/^[0-9A-Za-z]{6}$/.test(id) || files.length === 0) {
    return text("Uploading files failed — please try again", 400);
  }
  if (!publicBase(env)) {
    console.error("Missing R2_PUBLIC_URL");
    return text("Uploading files failed — please try again", 500);
  }
  if (await stub(env, id).exists()) {
    return text("Uploading files failed — please try again", 409);
  }

  const keys = keysFor(id, files.length);
  const base = publicBase(env)!;
  try {
    for (let i = 0; i < files.length; i++) {
      const head = await env.FILES.head(keys[i]);
      if (!head || head.size !== files[i].bytes) {
        await deleteKeys(env, keys);
        return text("Uploading files failed — please try again", 400);
      }
    }
    const content: Content = {
      id,
      title: fields.title,
      format: fields.format || (null as unknown as string),
      expires: fields.expires,
      burnAfterRead: fields.burnAfterRead,
      hasPassword: fields.hasPassword,
      text: fields.text,
      attachments: files.map((file, i) => ({
        data: `${base}/${keys[i]}`,
        name: file.name,
        size: Number((file.original / (1024 * 1024)).toFixed(2)),
      })),
      createdAt: new Date().toISOString(),
      expiresAt: fields.ttl
        ? new Date(Date.now() + fields.ttl * 1000).toISOString()
        : undefined,
    };
    await stub(env, id).save(content, keys, Date.now() + fields.maxAge * 1000);
    return Response.json(content);
  } catch (err) {
    console.error(err);
    await deleteKeys(env, keys);
    return text("Uploading files failed — please try again", 500);
  }
}

export async function abortUploads(req: Request, env: Bindings) {
  const body = await readJson(req);
  const id = typeof body?.id === "string" ? body.id : "";
  const count = typeof body?.count === "number" ? body.count : 0;
  const { count: max } = limits(env);
  if (!/^[0-9A-Za-z]{6}$/.test(id) || !Number.isInteger(count) || count < 1 || count > max) {
    return text("Not found", 404);
  }
  if (await stub(env, id).exists()) return new Response(null, { status: 204 });
  await deleteKeys(env, keysFor(id, count));
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
