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
- **Flexible expiration** — 10/30 minutes, 1/6/12 hours, 1/3/7 days, or **burn after read** (deleted the moment it's first viewed).
- **Optional password protection** — a 6–12 character password is mixed into the encryption parameters client-side, so even someone with the link can't decrypt without it.
- **QR code sharing** — instantly share a paste with another device.
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
6. For burn-after-read pastes, the record is deleted atomically on first fetch (a Redis lock prevents double reads), and any attachments are queued for deletion shortly after.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | [Next.js 15](https://nextjs.org/) (App Router, Turbopack) + React 19 |
| Styling | Tailwind CSS 4, [shadcn/ui](https://ui.shadcn.com/) (Radix UI) |
| Editor | [CodeMirror 6](https://codemirror.net/) |
| Data store | [Upstash Redis](https://upstash.com/) |
| File storage | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) or [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| Encryption | Web Crypto API (AES-128-GCM) |

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
| `CRON_SECRET` | Bearer token required to call `GET /api/cron` (expired-file cleanup) |

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

All content in these payloads is ciphertext; decryption happens in the browser using the URL fragment.

## Project structure

```
app/
  page.tsx           # Home: editor, attachments, expiry/password options
  [id]/page.tsx      # Paste viewer: fetches ciphertext and decrypts client-side
  api/route.ts       # POST  /api      — create paste
  api/[id]/route.ts  # GET   /api/:id  — fetch paste (burn-after-read handling)
  api/cron/route.ts  # GET   /api/cron — expired-file cleanup
components/          # Editor, header/footer, QR code, shadcn/ui primitives
lib/
  crypto.ts          # Client-side AES-GCM encrypt/decrypt + URL fragment codec
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

## License

[MIT](LICENSE)
