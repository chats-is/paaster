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
- **Pluggable storage** — attachments go to Vercel Blob or Cloudflare R2; metadata and ciphertext live in Redis with native TTL expiry.
- **Automatic cleanup** — a daily cron job removes expired attachment files from storage.
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
6. For burn-after-read pastes, the record is deleted atomically on first fetch (a Redis lock prevents double reads), and any attachments are queued for deletion shortly after. Unopened ones expire after 7 days.

## How nearby sharing works

The **Nearby** button (after publishing, and on the paste viewer) lists other devices on the same network with any Paaster page open, and sends one of them the link with a click.

1. **Same network = same public IP.** Devices behind one router reach the server from the same public IP (or, over IPv6, the same /64 prefix), so that's how they're grouped. Only a hash of it is stored. Requests from private addresses (local development) form one group.
2. **Every open tab checks in** with `POST /api/nearby` — every 4 s while visible, every 30 s in the background, every 2 s while the Nearby dialog is open — and is listed in Redis under its network with its device type (e.g. `iPhone · Chrome`). Tabs of the same browser show up as one device; closing a tab removes it straight away.
3. **Links are end-to-end encrypted.** Each tab makes an ECDH (P-256) key pair and lists only its public key. The sender derives a shared key with the receiving tab's public key and encrypts the link with AES-256-GCM, so the server never sees the link or the key after its `#`.
4. **Delivery** — the ciphertext waits in the receiving tab's inbox until its next check-in, where it's decrypted and shown as a toast. The receiver only takes the paste's path and key from it and opens it on its own site, so a link can never lead elsewhere.

Limits: a network lists at most 30 devices, a tab can send 10 links a minute, and inboxes keep links for 5 minutes.

> [!NOTE]
> - Everyone behind the same public IP counts as nearby — including strangers on mobile data (carrier NAT), office, campus or café Wi-Fi. They can see each other's device type and send each other Paaster links (which still need a click to open).
> - A device on IPv4 and one on IPv6 don't see each other.
> - Each check-in is about 3 Redis commands, so every open tab uses roughly 2,700 commands an hour while visible. Keep this in mind on a metered Redis plan.
> - Nearby sharing needs a secure context (HTTPS or `localhost`); the button doesn't appear otherwise.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) + React 19 |
| Styling | Tailwind CSS 4, [Lucide](https://lucide.dev/) icons, [Sonner](https://sonner.emilkowal.ski/) toasts |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Data store | [Upstash Redis](https://upstash.com/) |
| File storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) or [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| Encryption | Web Crypto API (AES-128-GCM; ECDH P-256 + AES-256-GCM for nearby links) |

## Getting started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/)
- An [Upstash Redis](https://upstash.com/) database
- A [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store **or** a [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket

### Setup

```bash
git clone https://github.com/<your-username>/paaster.git
cd paaster
pnpm install

cp .env.example .env.local
# fill in .env.local (see configuration below)

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

All settings live in `.env.local` (see [`.env.example`](.env.example) for the full annotated template).

### Redis (required)

| Variable | Description |
| --- | --- |
| `KV_REST_API_URL` | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Upstash Redis REST token |

### Storage backend

| Variable | Description |
| --- | --- |
| `STORAGE_PROVIDER` | `vercel` (default) or `r2` |
| `UPLOAD_PATH` | Object key prefix for uploaded files (default `paaster`) |

**Vercel Blob** (`STORAGE_PROVIDER=vercel`):

| Variable | Description |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token |

**Cloudflare R2** (`STORAGE_PROVIDER=r2`):

| Variable | Description |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API credentials |
| `R2_BUCKET` | Bucket name (must allow public read access) |
| `R2_PUBLIC_URL` | Public bucket URL (`https://pub-xxxx.r2.dev`) or a custom domain |

> [!IMPORTANT]
> `R2_PUBLIC_URL` must map to the **bucket root** with no path segment (e.g. `https://files.example.com`, not `https://files.example.com/cdn`). File cleanup derives the object key from the URL path and would otherwise silently leave expired files in the bucket.

### Upload limits

| Variable | Default | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_MAX_FILE_COUNT` | `10` | Max attachments per paste |
| `NEXT_PUBLIC_MAX_TOTAL_SIZE_MB` | `50` | Max total attachment size (MB) |

### Cron

| Variable | Description |
| --- | --- |
| `CRON_SECRET` | Bearer token required to call `GET /api/cron` (expired-file cleanup); the endpoint refuses every call while it's unset |

## Deployment

The app is designed for [Vercel](https://vercel.com/): connect the repository, set the environment variables above, and deploy. The included [`vercel.json`](vercel.json) schedules the cleanup cron daily at 01:00 UTC (Vercel sends `CRON_SECRET` automatically as the bearer token).

If you host elsewhere, schedule the cleanup yourself:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/cron
```

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api` | Create a paste (multipart form: encrypted text/files, format, expiry, flags) |
| `GET` | `/api/:id` | Fetch a paste's encrypted content (deletes it if burn-after-read) |
| `GET` | `/api/cron` | Delete expired attachment files (requires `CRON_SECRET`) |
| `POST` | `/api/nearby` | Nearby check-in: list this tab on its network, collect links sent to it, and (with `list: true`) get the other devices there |
| `POST` | `/api/nearby/send` | Send an encrypted link to another tab on the same network |
| `POST` | `/api/nearby/leave` | Remove a tab from its network's list (sent when the tab closes) |

All content in these payloads is ciphertext; decryption happens in the browser using the URL fragment, or for nearby links, the receiving tab's private key.

## Project structure

```
app/
  page.tsx           # Home: editor, attachments, expiry/password options
  [id]/page.tsx      # Paste viewer: fetches ciphertext and decrypts client-side
  api/route.ts       # POST  /api      — create paste
  api/[id]/route.ts  # GET   /api/:id  — fetch paste (burn-after-read handling)
  api/cron/route.ts  # GET   /api/cron — expired-file cleanup
  api/nearby/        # POST  /api/nearby, /send, /leave — nearby sharing
components/
  folder/            # The folder UI: create (share-folder), view (view-folder), shared parts
  nearby.tsx         # Nearby sharing: background check-ins, incoming links, the Nearby button
  editor.tsx         # CodeMirror editor
lib/
  crypto.ts          # Client-side AES-GCM encrypt/decrypt + URL fragment codec
  nearby.ts          # Nearby device identity and link encryption (client)
  nearby-server.ts   # Nearby network grouping, limits and validation (server)
  storage/           # Storage abstraction: Vercel Blob & Cloudflare R2 backends
  redis.ts           # Upstash Redis client
  config.ts          # Upload limit configuration
```

## Development

```bash
pnpm dev        # start dev server (Turbopack)
pnpm build      # production build
pnpm start      # serve production build
pnpm lint       # lint
pnpm lint:fix   # lint and auto-fix
```

### Testing nearby sharing on your network

Phones opening the dev server by its LAN IP over plain HTTP aren't in a secure context, so Web Crypto (and with it publishing, opening pastes and nearby sharing) is unavailable. Serve it over HTTPS with a self-signed certificate that covers the LAN IP:

```bash
mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -sha256 \
  -keyout certificates/dev-key.pem -out certificates/dev-cert.pem \
  -subj "/CN=paaster dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<your LAN IP>"

pnpm next dev --experimental-https \
  --experimental-https-key certificates/dev-key.pem \
  --experimental-https-cert certificates/dev-cert.pem
```

Then open `https://<your LAN IP>:3000` on each device and accept the certificate warning. Use two different browsers (or devices): tabs of the same browser count as one device.

> [!TIP]
> With Turbopack (`pnpm dev`), edits to shared components sometimes don't reach the server render of `/[id]`, which shows up as hydration mismatch errors. Restart the dev server, or run it without `--turbopack` as above.

## License

[MIT](LICENSE)
