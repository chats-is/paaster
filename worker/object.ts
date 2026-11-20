import { DurableObject } from "cloudflare:workers";

import type { NearbyDevice, NearbyEnvelope, NearbyPeer } from "@/lib/nearby";
import type { Content } from "@/lib/types";

import type { Bindings } from "./bindings";

export type ReadResult = { status: 200; content: Content } | { status: 404 };

// Attachments stay up after the record is deleted so a slow download can finish.
const DOWNLOAD_MS = 60 * 60 * 1000;

// How long a device stays listed after its last check-in. Hidden tabs check
// in every 30s, but Chrome holds timers in tabs hidden for 5+ minutes to
// once a minute, so they get well over that.
const ONLINE_MS = { visible: 15_000, hidden: 90_000 };
const ROOM_TTL_MS = 120_000;
const INBOX_TTL_MS = 300_000;
const MAX_DEVICES = 30;
const MAX_SENDS_PER_MINUTE = 10;

const isOnline = (device: NearbyDevice, now: number) =>
  now - device.seen < (device.visible ? ONLINE_MS.visible : ONLINE_MS.hidden);

interface Inbox {
  items: NearbyEnvelope[];
  exp: number;
}

interface Rate {
  count: number;
  resetAt: number;
}

export type CheckInResult =
  | { status: 200; inbox: NearbyEnvelope[]; devices?: NearbyPeer[] }
  | { status: 429 };

// One class for both jobs. A paste's name is its id; a nearby room's name is
// the network hash. Those names never collide, so each instance holds only
// one of the two. Requests for the same name run here one at a time.
export class PaasterObject extends DurableObject<Bindings> {
  async exists() {
    return (await this.ctx.storage.get("content")) !== undefined;
  }

  // `files` is the R2 keys to delete when the alarm fires. The text stays in
  // `content`. An empty list still marks this instance as a paste.
  async save(content: Content, files: string[], deleteAt: number) {
    await this.ctx.storage.transaction(async (txn) => {
      await txn.put("content", content);
      await txn.put("files", files);
      await txn.setAlarm(deleteAt);
    });
  }

  async read(): Promise<ReadResult> {
    const now = Date.now();
    return await this.ctx.storage.transaction(async (txn) => {
      const content = await txn.get<Content>("content");
      if (!content) return { status: 404 };
      if (content.expiresAt && Date.parse(content.expiresAt) <= now) {
        return { status: 404 };
      }
      if (content.burnAfterRead) {
        await txn.delete("content");
        const files = (await txn.get<string[]>("files")) ?? [];
        if (files.length > 0) await txn.setAlarm(now + DOWNLOAD_MS);
      }
      return { status: 200, content };
    });
  }

  async checkIn(me: NearbyDevice, list: boolean): Promise<CheckInResult> {
    return await this.ctx.storage.transaction(async (txn) => {
      const now = Date.now();
      const devices =
        (await txn.get<Record<string, NearbyDevice>>("devices")) ?? {};
      const added = devices[me.id] ? 0 : 1;
      devices[me.id] = me;
      // Taken before the room-full check, and dropped if this device is refused.
      const inbox = await takeInbox(txn, me.id, now);

      let rejected = false;
      let online: NearbyDevice[] | undefined;
      if (list || added > 0) {
        const stale: string[] = [];
        online = Object.values(devices).filter((device) => {
          if (isOnline(device, now)) return true;
          stale.push(device.id);
          return false;
        });
        if (added > 0 && online.length > MAX_DEVICES) {
          rejected = true;
          stale.push(me.id);
        }
        for (const id of stale) delete devices[id];
      }

      if (Object.keys(devices).length === 0) await txn.delete("devices");
      else await txn.put("devices", devices);
      await txn.setAlarm(now + ROOM_TTL_MS);

      if (rejected) return { status: 429 };
      if (!list || !online) return { status: 200, inbox };

      const byBrowser = new Map<string, NearbyDevice>();
      for (const device of online) {
        if (device.browser === me.browser) continue;
        const current = byBrowser.get(device.browser);
        if (
          !current ||
          (device.visible && !current.visible) ||
          (device.visible === current.visible && device.seen > current.seen)
        ) {
          byBrowser.set(device.browser, device);
        }
      }
      const peers = [...byBrowser.values()]
        .sort((a, b) => a.kind.localeCompare(b.kind))
        .map(({ id, kind, key }) => ({ id, kind, key }));
      return { status: 200, inbox, devices: peers };
    });
  }

  async send(
    fromId: string,
    toId: string,
    envelope: NearbyEnvelope,
  ): Promise<"ok" | "missing" | "limited"> {
    return await this.ctx.storage.transaction(async (txn) => {
      const now = Date.now();
      const devices =
        (await txn.get<Record<string, NearbyDevice>>("devices")) ?? {};
      const from = devices[fromId];
      const target = devices[toId];
      if (!from || !target || !isOnline(target, now)) return "missing";

      const rateKey = `rate:${fromId}`;
      let rate = await txn.get<Rate>(rateKey);
      if (!rate || rate.resetAt <= now) {
        rate = { count: 0, resetAt: now + 60_000 };
      }
      rate.count += 1;
      await txn.put(rateKey, rate);
      if (rate.count > MAX_SENDS_PER_MINUTE) return "limited";

      const inboxKey = `inbox:${toId}`;
      const existing = await txn.get<Inbox>(inboxKey);
      const items =
        existing && existing.exp > now ? existing.items.slice(-19) : [];
      items.push(envelope);
      await txn.put(inboxKey, { items, exp: now + INBOX_TTL_MS });
      await txn.setAlarm(now + ROOM_TTL_MS);
      return "ok";
    });
  }

  async leave(id: string) {
    await this.ctx.storage.transaction(async (txn) => {
      const devices =
        (await txn.get<Record<string, NearbyDevice>>("devices")) ?? {};
      if (!devices[id]) return;
      delete devices[id];
      if (Object.keys(devices).length === 0) await txn.delete("devices");
      else await txn.put("devices", devices);
      await txn.setAlarm(Date.now() + ROOM_TTL_MS);
    });
  }

  async alarm() {
    // Paste instances store a `files` list, even when it is empty. Nearby
    // rooms never do, so the same alarm handler can serve both.
    const files = await this.ctx.storage.get<string[]>("files");
    if (files) {
      await this.deleteFiles();
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const now = Date.now();
    await this.ctx.storage.transaction(async (txn) => {
      const devices =
        (await txn.get<Record<string, NearbyDevice>>("devices")) ?? {};
      for (const [id, device] of Object.entries(devices)) {
        if (!isOnline(device, now)) delete devices[id];
      }
      const alive = Object.keys(devices).length > 0;
      if (alive) await txn.put("devices", devices);
      else await txn.delete("devices");

      for (const [key, value] of await txn.list<Inbox>({ prefix: "inbox:" })) {
        if (value.exp <= now) await txn.delete(key);
      }
      for (const [key, value] of await txn.list<Rate>({ prefix: "rate:" })) {
        if (value.resetAt <= now) await txn.delete(key);
      }

      const remaining = await txn.list();
      if (remaining.size === 0) await txn.deleteAlarm();
      else await txn.setAlarm(now + ROOM_TTL_MS);
    });
  }

  private async deleteFiles() {
    const files = (await this.ctx.storage.get<string[]>("files")) ?? [];
    const results = await Promise.allSettled(
      files.map((key) => this.env.FILES.delete(key)),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
}

async function takeInbox(
  txn: DurableObjectTransaction,
  id: string,
  now: number,
) {
  const key = `inbox:${id}`;
  const box = await txn.get<Inbox>(key);
  if (!box || box.exp <= now) {
    if (box) await txn.delete(key);
    return [];
  }
  const inbox = box.items.slice(0, 10);
  const rest = box.items.slice(10);
  if (rest.length === 0) await txn.delete(key);
  else await txn.put(key, { items: rest, exp: box.exp });
  return inbox;
}
