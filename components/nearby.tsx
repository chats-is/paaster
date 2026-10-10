"use client";

import {
  CheckIcon,
  LaptopIcon,
  LoaderCircleIcon,
  RadarIcon,
  SmartphoneIcon,
  TabletIcon,
  XIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  button,
  dialog,
  iconButton,
  paperDialog,
  phoneHidden,
  phoneIconOnly,
} from "@/components/folder/folder-parts";
import { PasswordIcon } from "@/components/icons/password-icon";
import {
  createSelf,
  isNearbySupported,
  type NearbyEnvelope,
  type NearbyMessage,
  type NearbyPeer,
  type NearbySelf,
  openMessage,
  sealMessage,
} from "@/lib/nearby";
import { cn } from "@/lib/utils";

// How often this tab checks in: often while the send dialog is open, less
// when nobody's looking.
const POLL_MS = { watching: 2000, visible: 4000, hidden: 30000 };

type Nearby = {
  peers: NearbyPeer[];
  watch: () => () => void;
  send: (peer: NearbyPeer, link: Omit<NearbyMessage, "kind">) => Promise<void>;
};

const NearbyContext = createContext<Nearby | null>(null);

// Keeps this tab listed for nearby devices on every page, and shows links
// they send it.
export function NearbyProvider({ children }: { children: React.ReactNode }) {
  const self = useRef<NearbySelf>(null);
  const kick = useRef<() => void>(() => {});
  const watching = useRef(0);
  const [ready, setReady] = useState(false);
  const [peers, setPeers] = useState<NearbyPeer[]>([]);

  useEffect(() => {
    if (!isNearbySupported()) return;
    let stopped = false;
    let busy = false;
    // Asked for while a check-in was in flight: go again as soon as it's done.
    let again = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const receive = async (envelope: NearbyEnvelope) => {
      try {
        const message = await openMessage(self.current!, envelope);
        // Only a paste's path and key are taken from the link; it always
        // opens on this site, whatever address the sender reached it by
        // (localhost vs. the LAN IP in development).
        const sent = new URL(message.url);
        if (!/^\/[A-Za-z0-9]+$/.test(sent.pathname)) return;
        const url = new URL(sent.pathname + sent.hash, window.location.origin);
        toast(`Link from ${message.kind}`, {
          id: envelope.iv,
          // The address (in the link colour), the password icon if it
          // needs one, then its title.
          description: (
            <>
              <span className="text-primary">{url.pathname}</span>
              {message.password && (
                <span title="Password needed">
                  <PasswordIcon className="ml-1.5 inline size-4 align-[-3.5px]" />
                  <span className="sr-only">Password needed</span>
                </span>
              )}
              {message.title && (
                <span className="ml-1.5">{message.title}</span>
              )}
            </>
          ),
          // The sender's device, as in the Nearby list.
          icon: (
            <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
              <DeviceIcon kind={message.kind} />
            </span>
          ),
          duration: Infinity,
          action: {
            label: "Open",
            onClick: () => window.open(url.href, "_blank", "noopener"),
          },
          cancel: { label: "Dismiss", onClick: () => {} },
          classNames: {
            // Sonner's icon slot is 16px; make room for the round badge.
            icon: "size-10! mr-1!",
            // One line each beside the buttons; long titles end in "…".
            content: "min-w-0",
            title: "truncate",
            description: "truncate",
            // Sonner gives every button margin-left: auto, which splits the
            // free space between them; keep Open next to Dismiss.
            actionButton: "ml-2!",
          },
        });
      } catch {
        // Not for this tab's key (it was reloaded) or tampered with.
      }
    };

    const tick = async () => {
      clearTimeout(timer);
      // A check-in already in flight schedules the next one.
      if (busy) again = true;
      if (busy || stopped || !self.current) return;
      busy = true;
      again = false;
      try {
        const { id, browser, kind, key } = self.current;
        const res = await fetch("/api/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            browser,
            kind,
            key,
            visible: !document.hidden,
            // Only the send dialog shows the other devices.
            list: watching.current > 0,
          }),
        });
        if (res.ok && !stopped) {
          const { devices, inbox } = await res.json();
          if (devices) setPeers(devices);
          (inbox as NearbyEnvelope[]).forEach(receive);
        }
      } catch {
        // Offline for a moment; try again next time.
      } finally {
        busy = false;
      }
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(
        tick,
        again
          ? 0
          : document.hidden
            ? POLL_MS.hidden
            : watching.current > 0
              ? POLL_MS.watching
              : POLL_MS.visible,
      );
    };

    const onVisible = () => {
      if (!document.hidden) tick();
    };
    // Drop off other devices' lists as soon as this tab goes away.
    const onLeave = () => {
      if (self.current) {
        navigator.sendBeacon("/api/nearby/leave", self.current.id);
      }
    };
    const onBack = (e: PageTransitionEvent) => {
      if (e.persisted) tick();
    };

    createSelf().then((s) => {
      if (stopped) return;
      self.current = s;
      kick.current = tick;
      setReady(true);
      tick();
    });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("pageshow", onBack);
    return () => {
      stopped = true;
      clearTimeout(timer);
      onLeave();
      kick.current = () => {};
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("pageshow", onBack);
    };
  }, []);

  const watch = useCallback(() => {
    watching.current++;
    // The list was last fetched whenever the dialog was last open; start
    // from "looking" rather than show devices that may have gone.
    setPeers([]);
    kick.current();
    return () => {
      watching.current--;
    };
  }, []);

  const send = useCallback(
    async (peer: NearbyPeer, link: Omit<NearbyMessage, "kind">) => {
      const s = self.current;
      if (!s) throw new Error("Nearby sharing isn't ready yet");
      const envelope = await sealMessage(s, peer, { ...link, kind: s.kind });
      const res = await fetch("/api/nearby/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: peer.id, envelope }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || "Couldn't send the link");
      }
    },
    [],
  );

  return (
    <NearbyContext.Provider value={ready ? { peers, watch, send } : null}>
      {children}
    </NearbyContext.Provider>
  );
}

const without = <T,>(record: Record<string, T>, key: string) =>
  Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

const DeviceIcon = ({ kind }: { kind: string }) =>
  /iPhone|phone/.test(kind) ? (
    <SmartphoneIcon />
  ) : /iPad|tablet/.test(kind) ? (
    <TabletIcon />
  ) : (
    <LaptopIcon />
  );

// "Nearby" button: lists devices on the same network with Paaster open, and
// sends them `url` with a click; `password` tells them they'll need one to
// open it. Renders nothing where nearby sharing can't work (no Web Crypto
// outside a secure context).
export function NearbyButton({
  url,
  title,
  password,
  className,
}: {
  url: string;
  title?: string;
  password?: boolean;
  className?: string;
}) {
  const nearby = useContext(NearbyContext);
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Record<string, "sending" | "sent">>({});

  const watch = nearby?.watch;
  useEffect(() => {
    if (open && watch) return watch();
  }, [open, watch]);

  if (!nearby) return null;
  const { peers, send } = nearby;

  const sendTo = async (peer: NearbyPeer) => {
    if (state[peer.id]) return;
    setState((s) => ({ ...s, [peer.id]: "sending" }));
    try {
      await send(peer, { url, title, password });
      setState((s) => ({ ...s, [peer.id]: "sent" }));
      toast.success(`Sent to ${peer.kind}`);
      setTimeout(() => setState((s) => without(s, peer.id)), 2000);
    } catch (err) {
      setState((s) => without(s, peer.id));
      toast.error(
        err instanceof Error ? err.message : "Couldn't send the link",
      );
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
        className={cn(button, phoneIconOnly, className)}
      >
        <RadarIcon />
        <span className={phoneHidden}>Nearby</span>
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className={cn(dialog, "w-[min(360px,calc(100vw-32px))]")}
      >
        <div className={paperDialog}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <b className="text-base font-semibold">Send to a nearby device</b>
            <button
              type="button"
              aria-label="Close"
              onClick={() => ref.current?.close()}
              className={iconButton}
            >
              <XIcon />
            </button>
          </div>

          {peers.length > 0 ? (
            <ul className="grid gap-0.5">
              {peers.map((peer) => (
                <li key={peer.id}>
                  <button
                    type="button"
                    onClick={() => sendTo(peer)}
                    aria-disabled={!!state[peer.id]}
                    className="flex w-full cursor-pointer items-center rounded-md py-2 pr-3 pl-1.5 text-left hover:bg-paper-muted aria-disabled:cursor-default"
                  >
                    <span className="mr-2 grid size-9 shrink-0 place-items-center rounded-full bg-paper-muted text-paper-foreground-muted [&_svg]:size-[18px]">
                      <DeviceIcon kind={peer.kind} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                      {peer.kind}
                    </span>
                    <span className="ml-3 shrink-0 text-[12.5px] font-medium [&_svg]:size-4">
                      {state[peer.id] === "sending" ? (
                        <LoaderCircleIcon className="animate-spin text-paper-foreground-muted" />
                      ) : state[peer.id] === "sent" ? (
                        <span className="flex items-center gap-1 text-key">
                          <CheckIcon />
                          Sent
                        </span>
                      ) : (
                        <span className="text-primary">Send</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-2 py-5 text-center">
              {/* radar with rings spreading out, a third of a cycle apart
                  (negative delays, so all three are moving from the start) */}
              <div className="relative grid size-20 place-items-center">
                {[0, -0.8, -1.6].map((delay) => (
                  <span
                    key={delay}
                    style={{ animationDelay: `${delay}s` }}
                    className="absolute inset-0 animate-radar-ring rounded-full border-[1.5px] border-primary/40 bg-primary/5 motion-reduce:hidden"
                  />
                ))}
                <span className="relative grid size-10 place-items-center rounded-full bg-paper-muted text-primary [&_svg]:size-5">
                  <RadarIcon />
                </span>
              </div>
              <p className="max-w-[260px] text-[13px] text-paper-foreground-muted">
                Looking for devices… Open Paaster on another device on the same
                Wi-Fi and it will show up here.
              </p>
            </div>
          )}

          <p className="mt-3 border-t border-[#e3e9f2] pt-3 text-[12px] text-paper-foreground-muted">
            Links are encrypted for the receiving device before they leave
            this one.
          </p>
        </div>
      </dialog>
    </>
  );
}
