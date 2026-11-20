<p align="center">
  <img src="public/logo.svg" alt="paaster logo" width="80" height="80" />
</p>

<h1 align="center">paaster</h1>

<p align="center">
  End-to-end encrypted text and file sharing platform.<br />
  Content is encrypted in your browser before upload — the server never sees the plaintext or the key.
</p>

## Features

- **End-to-end encryption** — text and files are encrypted client-side with AES-128-GCM via the Web Crypto API. The decryption key lives only in the URL fragment (`#...`), which browsers never send to the server.
- **Code editor with syntax highlighting** — CodeMirror 6 with support for 17 languages (Markdown, Python, JavaScript/TypeScript, Java, SQL, HTML, CSS, C/C++, Go, PHP, Rust, JSON, YAML, XML, and plain text).
- **File attachments** — share multiple encrypted files alongside (or instead of) text. File count and total size limits are configurable.
- **Flexible expiration** — 10/30 minutes, 1/6/12 hours, 1/3/7 days, or **burn after read** (deleted the moment it's first viewed, or after 7 days if nobody opens it).
- **Optional password protection** — a 6–12 character password is mixed into the encryption parameters client-side, so even someone with the link can't decrypt without it.
- **QR code sharing** — instantly share a paste with another device.
- **Nearby sharing** — send a link straight to another device on the same network that has Paaster open; it pops up there with an Open button. The link is encrypted for the receiving device first, so the server only relays ciphertext.
- **One Durable Object class** — each paste gets an instance (metadata, the burn-after-read lock, and the expiry alarm), and each network gets its own instance (devices and inboxes). Requests for the same name run one at a time, so a burn-after-read paste can be opened once.
- **Automatic cleanup** — the paste's alarm deletes its R2 objects at expiry, or one hour after a burn-after-read paste is opened.
- **Dark / light theme** — follows your system preference, toggleable.

## How the encryption works

1. When you publish, the browser generates a random AES-128-GCM key and a 12-byte IV.
2. Text and attachments are encrypted locally; only ciphertext is uploaded.
3. The key + IV are base62-encoded into a URL fragment, producing a link like:

   ```
   https://your-domain.com/Ab3xYz#3fK9...38-char-fragment...
   ```

4. The fragment (`#...`) is never included in HTTP requests, so the server stores ciphertext it cannot decrypt.
5. If a password is set, it is folded into the IV derivation client-side — the password itself is never transmitted; the server only stores a `hasPassword` flag.
6. For burn-after-read pastes, the record is deleted on first fetch. The paste's Durable Object handles that request alone, so a second fetch cannot read it. Attachments are deleted an hour later. Unopened ones expire after 7 days.

## How nearby sharing works

The **Nearby** button (after publishing, and on the paste viewer) lists other devices on the same network with any Paaster page open, and sends one of them the link with a click.

1. **Same network = same public IP.** Devices behind one router reach the server from the same public IP (or, over IPv6, the same /64 prefix), so that's how they're grouped. Only a hash of it is stored. `CF-Connecting-IP` is the address. Requests without one (local development) form one group.
2. **Every open tab checks in** with `POST /api/nearby` — every 4 s while visible, every 30 s in the background, every 2 s while the Nearby dialog is open — and is listed on its network's Durable Object with its device type (e.g. `iPhone · Chrome`). Tabs of the same browser show up as one device; closing a tab removes it straight away.
3. **Links are end-to-end encrypted.** Each tab makes an ECDH (P-256) key pair and lists only its public key. The sender derives a shared key with the receiving tab's public key and encrypts the link with AES-256-GCM, so the server never sees the link or the key after its `#`.
4. **Delivery** — the ciphertext waits in the receiving tab's inbox until its next check-in, where it's decrypted and shown as a toast. The receiver only takes the paste's path and key from it and opens it on its own site, so a link can never lead elsewhere.

Limits: a network lists at most 30 devices, a tab can send 10 links a minute, and inboxes keep links for 5 minutes.

> [!NOTE]
> - Everyone behind the same public IP counts as nearby — including strangers on mobile data (carrier NAT), office, campus or café Wi-Fi. They can see each other's device type and send each other Paaster links (which still need a click to open).
> - A device on IPv4 and one on IPv6 don't see each other.
> - Each check-in is one request to that network's Durable Object, so every open tab makes roughly 900 requests an hour while visible. Keep this in mind on a metered Workers plan.
> - Nearby sharing needs a secure context (HTTPS or `localhost`); the button doesn't appear otherwise.

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, Vite, [React Router](https://reactrouter.com/) |
| Styling | Tailwind CSS 4, [Lucide](https://lucide.dev/) icons, [Sonner](https://sonner.emilkowal.ski/) toasts |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Server | [Cloudflare Workers](https://developers.cloudflare.com/workers/) |
| Paste and nearby state | One [Durable Object](https://developers.cloudflare.com/durable-objects/) class. An instance per paste, and an instance per network |
| File storage | [Cloudflare R2](https://developers.cloudflare.com/r2/), public bucket URL |
| Encryption | Web Crypto API (AES-128-GCM; ECDH P-256 + AES-256-GCM for nearby links) |

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- For deployment: a Cloudflare account. Local development simulates Durable Objects. File upload uses the real bucket, so it also needs that account and the secrets below.

### Setup

```bash
git clone https://github.com/<your-username>/paaster.git
cd paaster
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If `certificates/dev-cert.pem` and `certificates/dev-key.pem` exist, the dev server uses them and the address is `https://localhost:3000`.

## Configuration

Limits have defaults and can be changed in [`wrangler.jsonc`](wrangler.jsonc):

| Variable | Default | Description |
| --- | --- | --- |
| `MAX_FILE_COUNT` | `10` | Max attachments per paste |
| `MAX_TOTAL_SIZE_MB` | `100` | Max total attachment size (MB) |

The browser uses the same defaults. The Worker is what actually rejects an upload.

Turn on public access for the existing `paaster` bucket. The browser uploads encrypted files directly to that bucket. Attachment links are its public URL. Text stays in the paste record. The paste's Durable Object alarm deletes expired objects.

Set these as Worker secrets (`pnpm exec wrangler secret put <NAME>`). For local development, put the same values in `.dev.vars`. `pnpm dev` uses the real bucket.

| Name | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id. The upload host is `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 API token access key id |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET` | Bucket name used in the upload address. It must match the `bucket_name` binding in `wrangler.jsonc` |
| `R2_PUBLIC_URL` | Public base URL of the bucket, no trailing slash, for example `https://pub-xxxx.r2.dev` |

## Deployment

The Worker binds the existing R2 bucket named `paaster` (`FILES` in `wrangler.jsonc`). Deploy with:

```bash
pnpm run deploy
```

`pnpm run deploy` builds the UI and the Worker and runs `wrangler deploy`. Durable Object migrations are declared in `wrangler.jsonc`. If the bucket is missing in the account you deploy to, create it once with `npx wrangler r2 bucket create paaster`.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api` | Save one paste. With files, the form also carries the upload id and file names |
| `POST` | `/api/uploads` | Sign direct upload URLs for a paste's files |
| `POST` | `/api/uploads/abort` | Delete objects from an upload that did not finish |
| `GET` | `/api/:id` | Fetch a paste's encrypted content (deletes it if burn-after-read) |
| `POST` | `/api/nearby` | Nearby check-in: list this tab on its network, collect links sent to it, and (with `list: true`) get the other devices there |
| `POST` | `/api/nearby/send` | Send an encrypted link to another tab on the same network |
| `POST` | `/api/nearby/leave` | Remove a tab from its network's list (sent when the tab closes) |

All content in these payloads is ciphertext; decryption happens in the browser using the URL fragment, or for nearby links, the receiving tab's private key.

## Project structure

```
index.html             # Shell: fonts, theme colour, stage scale
src/main.tsx           # Routes: / editor, /:id viewer
components/
  desk/                # The desk UI: create (share-desk), view (view-desk), shared parts
  nearby.tsx           # Nearby sharing: background check-ins, incoming links, the Nearby button
  editor.tsx           # CodeMirror editor
lib/
  crypto.ts            # Client-side AES-GCM encrypt/decrypt + URL fragment codec
  nearby.ts            # Nearby device identity and link encryption (client)
  config.ts            # Browser copy of the upload limits
worker/
  index.ts             # /api routes
  object.ts            # PaasterObject: one instance per paste, one per network
  nearby.ts            # Nearby device and message validation
  network.ts           # Public-IP grouping (CF-Connecting-IP, IPv6 /64)
```

## Development

```bash
pnpm dev        # Vite dev server and the Worker, on port 3000
pnpm build      # production build
pnpm preview    # serve the production build locally
pnpm run deploy     # build and wrangler deploy
pnpm lint       # lint
pnpm typecheck  # tsc --noEmit
```

### Testing nearby sharing on your network

Phones opening the dev server by its LAN IP over plain HTTP aren't in a secure context, so Web Crypto (and with it publishing, opening pastes and nearby sharing) is unavailable. Serve it over HTTPS with a self-signed certificate that covers the LAN IP:

```bash
mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -sha256 \
  -keyout certificates/dev-key.pem -out certificates/dev-cert.pem \
  -subj "/CN=paaster dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<your LAN IP>"

pnpm dev -- --host
```

Then open `https://<your LAN IP>:3000` on each device and accept the certificate warning. Use two different browsers (or devices): tabs of the same browser count as one device. Both devices share one nearby group in local development, because there is no `CF-Connecting-IP`.

## License

[MIT](LICENSE)
