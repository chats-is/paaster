import type { NearbyDevice, NearbyEnvelope } from "@/lib/nearby";

export const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[\w-]{8,40}$/.test(value);

export function parseDevice(body: unknown): NearbyDevice | undefined {
  const record = body as Partial<NearbyDevice> | null;
  if (
    !record ||
    !isId(record.id) ||
    !isId(record.browser) ||
    typeof record.kind !== "string" ||
    typeof record.key !== "string" ||
    record.kind.length > 40 ||
    record.key.length > 200
  ) {
    return;
  }
  return {
    id: record.id,
    browser: record.browser,
    kind: record.kind,
    key: record.key,
    visible: !!record.visible,
    seen: Date.now(),
  };
}

export function parseEnvelope(body: unknown): NearbyEnvelope | undefined {
  const record = body as Partial<NearbyEnvelope> | null;
  if (
    !record ||
    !isId(record.from) ||
    typeof record.key !== "string" ||
    typeof record.iv !== "string" ||
    typeof record.data !== "string" ||
    record.key.length > 200 ||
    record.iv.length > 40 ||
    record.data.length > 4096
  ) {
    return;
  }
  return {
    from: record.from,
    key: record.key,
    iv: record.iv,
    data: record.data,
  };
}
