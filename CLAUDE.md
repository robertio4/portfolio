# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio whose sole surface is a bilingual (ES/EN) chatbot that only answers questions about Roberto Rodríguez. The knowledge base is built from documents in `doc/` (currently `CV_ES_2.pdf`). Public web → cost exposure is controlled by four defensive layers so the expected spend is $0.

## Commands

All commands run from the repo root. Package manager is **pnpm** (declared via `corepack`). Use `corepack enable pnpm && corepack prepare pnpm@9.15.0 --activate` once to provision it.

```bash
pnpm install              # install workspaces (web + api)
pnpm dev                  # run web (:5173) and api (:8787) concurrently
pnpm build                # build both packages
pnpm db:migrate           # create SQLite schema at api/data/metrics.db
pnpm ingest               # parse doc/*, embed chunks, write api/src/rag/index.json
pnpm typecheck            # tsc --noEmit on both packages
pnpm --filter api test    # run integration tests (node:test, 32 tests)
pnpm --filter api list-models   # print Gemini model IDs the current key can call
```

Single-package commands: `pnpm --filter web <script>`, `pnpm --filter api <script>`.

Secrets live in `api/.env` and `web/.env` — copy `.env.example` and fill. `GOOGLE_API_KEY`, Turnstile keys, `IP_SALT`, and `ADMIN_TOKEN` are all required.

## Architecture

Two packages glued by pnpm workspaces:

- **`web/`** — Vite + React 18 SPA, two routes: `/` (public chat) and `/admin` (metrics dashboard, bearer-gated).
- **`api/`** — Hono on Node, SSE streaming. Single process, all state in-memory except SQLite for metrics.

### Request pipeline (`POST /api/chat`)

`turnstileMiddleware` → `rateLimitMiddleware` → `dailyCapMiddleware` → handler. Any failure short-circuits with JSON error. The handler:

1. Enriches IP locally with `geoip-lite` + `ua-parser-js` (no external calls).
2. Upserts a row in `visitors` keyed by `SHA256(ip + IP_SALT)` — IPs are never stored in clear.
3. Embeds the latest user message via Gemini `gemini-embedding-001` with `outputDimensionality: 768`.
4. Checks the in-memory semantic cache (LRU 100, cosine ≥ 0.92, TTL 24h). On hit, streams the cached answer word-by-word.
5. On miss, retrieves top-5 chunks from `index.json` (loaded once at boot) whose cosine similarity ≥ 0.5 (chunks below this threshold are discarded — the LLM then receives empty context and correctly says "I don't have that information" rather than hallucinating). Calls `gemini-3.1-flash-lite-preview` with system prompt + context. Streams deltas as SSE (`event: delta` / `event: done` / `event: error`).
6. Always logs a row in `queries` (question, visitor_id, browser/OS/device, lang, cache_hit, status).

### RAG ingest (offline, run manually)

`pnpm ingest` walks `doc/**/*.{pdf,md,txt}`, extracts text (`pdf-parse` for PDFs), chunks at ≈1800 chars with 200 overlap, batches embeddings (100 per call), writes `api/src/rag/index.json`. Commit the generated JSON — there is no runtime regeneration.

### Gemini models

Both models are pinned in [`api/src/llm/gemini.ts`](api/src/llm/gemini.ts):

- **Chat**: `gemini-3.1-flash-lite-preview` — chosen because it's the only free-tier text model with meaningful daily quota (500 RPD / 15 RPM / 250K TPM at time of writing). `gemini-2.5-flash`, `2.0-flash*` and the Pro variants all return `0/0` in free tier.
- **Embeddings**: `gemini-embedding-001` at `outputDimensionality: 768`. The default 3072-d would 4× the size of `index.json` with no accuracy gain for this corpus. Keep chunk and query embeddings on the same model or cosine scores become meaningless.

Preview models get renamed or sunset without notice. If the API returns 404 on chat, run `pnpm --filter api list-models` to see what the current key can call, then update `CHAT_MODEL`. `gemini-flash-lite-latest` is the stable alias (but currently points to 2.5 Flash Lite with only 20 RPD — avoid unless free tier for 3.1 disappears).

### Defensive layers — all are load-bearing

| Layer | Where | Purpose |
|-------|-------|---------|
| Cloudflare Turnstile (invisible) | `middleware/turnstile.ts` + `hooks/useTurnstile.ts` | Bot challenge on every request |
| Rate limit per IP | `middleware/rateLimit.ts` | In-memory Maps: 5/min + 30/day (env-tunable) |
| Daily hard cap | `middleware/dailyCap.ts` | Reads SQLite `daily_counter` on every request (fast in-process read); over cap → 503 + frontend swaps to `FallbackFaq` |
| Semantic cache | `rag/semanticCache.ts` | Repeated paraphrases cost 0 tokens |

### Admin surface (`/admin`)

Bearer-authenticated (`ADMIN_TOKEN`, stored in `sessionStorage`). Read-only views: stats cards (24h/7d/30d), visitors table, visitor detail with timeline, queries with LIKE search, top questions, country breakdown. No external chart libs — CSS bars and semantic tables only.

## Non-negotiable constraints

- **No AWS-specific code in the API** (no `aws-sdk`, RDS, S3, Secrets Manager). State must stay in `data/metrics.db` + `.env` so a migration to Oracle/Pi/self-host is `scp` + `systemctl`.
- **No paid SaaS on the hot path.** Gemini (free tier), Turnstile (free), SQLite (local), `geoip-lite` (bundled). Anything else needs an explicit decision.
- **IPs never stored in clear.** Always hash with `IP_SALT` before persisting.
- **i18n is home-grown** (`web/src/i18n/`). Do not add `react-i18next` or similar.
- **No Inter / Roboto / Arial / Space Grotesk** in the UI — typography is Fraunces + JetBrains Mono (editorial dark aesthetic).
- The LLM always replies in the language of the user's question, regardless of UI toggle (enforced by `api/src/llm/prompt.ts`). Do not route responses through the UI `lang`.

## Deployment target

AWS EC2 t4g.micro (ARM, free tier 12mo) for the API behind Caddy; Cloudflare Pages for `web/dist`. Everything ARM-compatible (better-sqlite3 has prebuilt linux-arm64 binaries). Backups via EBS snapshots configured in the AWS console — no code required.

## Installed Claude skills

- `frontend-design` (`.agents/skills/frontend-design/`) — invoke before writing any UI. Enforces bold aesthetic commitment, distinctive typography, staggered motion, textured backgrounds.
- `find-skills` — invoke when asked "how do I do X" or to extend agent capabilities. Commands: `npx skills find <query>`, `npx skills add <owner/repo@skill>`, `npx skills check`, `npx skills update`. Verify install count (prefer 1K+) before recommending.
