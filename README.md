# Portfolio

Personal portfolio of Roberto Rodríguez. The entire surface is a bilingual chat that only answers questions about Roberto, grounded in the documents under `doc/`.

## Stack

- **web** — Vite + React 18 + TypeScript. Editorial dark aesthetic (Fraunces + JetBrains Mono, amber accent).
- **api** — Hono on Node. SSE streaming. `gemini-3.1-flash-lite-preview` for chat, `gemini-embedding-001` (768-d) for embeddings. SQLite (via `better-sqlite3`) for metrics.

Everything in-memory except metrics. Four defensive layers (Turnstile, per-IP rate limit, semantic cache, daily hard cap) keep the expected spend at $0.

## Setup

Requires Node 20+ and pnpm. If you don't have pnpm:

```bash
corepack enable pnpm && corepack prepare pnpm@9.15.0 --activate
```

```bash
pnpm install
cp .env.example api/.env        # fill GOOGLE_API_KEY, TURNSTILE_*, IP_SALT, ADMIN_TOKEN
cp .env.example web/.env        # fill VITE_* mirrors
pnpm db:migrate                 # create api/data/metrics.db
pnpm ingest                     # build api/src/rag/index.json from doc/
pnpm dev                        # web :5173, api :8787
```

## Adding documents

Drop any `.pdf`, `.md`, or `.txt` into `doc/`. Run `pnpm ingest` to regenerate the embeddings index. Commit `api/src/rag/index.json`.

## Gemini models

Pinned in [`api/src/llm/gemini.ts`](api/src/llm/gemini.ts). Free tier at time of writing only funds `gemini-3.1-flash-lite-preview` (500 RPD) and `gemini-embedding-001` (1 000 RPD). If the API returns 404, Google rotated the preview — list available IDs with `pnpm --filter api list-models` and update `CHAT_MODEL`.

## Admin dashboard

Open `/admin`, enter `ADMIN_TOKEN`. Token lives in `sessionStorage`, cleared on logout or auth failure.

## Environment variables

See [`.env.example`](./.env.example). Every key is required — the API refuses to boot with an invalid config.

## Deployment

- **web** → Cloudflare Pages (build command `pnpm --filter web build`, output `web/dist`).
- **api** → AWS EC2 t4g.micro behind Caddy. Backups via EBS snapshots.

The API is deliberately portable — no AWS-specific SDKs. To migrate to self-host: `scp api/data/metrics.db`, clone, install, configure systemd.
