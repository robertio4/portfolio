# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal portfolio whose sole surface is a bilingual (ES/EN) chatbot that only answers questions about Roberto Rodríguez. The knowledge base is built from documents in `doc/` (a CV PDF plus `contact.md` — a small bilingual file that gives Roberto's contact details their own retrieval-dense chunk; see the ingest note below). `doc/` is gitignored (personal source docs); only the embedded `api/src/rag/index.json` is committed. Public web → cost exposure is controlled by four defensive layers so the expected spend is $0.

## Commands

All commands run from the repo root. Package manager is **pnpm** (declared via `corepack`). Use `corepack enable pnpm && corepack prepare pnpm@9.15.0 --activate` once to provision it.

```bash
pnpm install              # install JS workspaces (web + api); the agent is a Python package (see below)
pnpm dev                  # run web (:5173), api (:8787) and agent (:8788) concurrently
pnpm build                # build web + api (the agent is not bundled)
pnpm db:migrate           # create SQLite schema at api/data/metrics.db
pnpm ingest               # parse doc/*, embed chunks, write api/src/rag/index.json
pnpm typecheck            # tsc --noEmit on web + api
pnpm --filter api test    # run integration tests (node:test, 32 tests)
pnpm --filter api list-models   # print Gemini model IDs the current key can call (embeddings live tier)
```

The **agent** (`agent/`) is a Python package, not part of the pnpm install. Provision it once
with `uv sync` (or `python -m venv .venv && .venv/bin/pip install -e .`) inside `agent/`; `pnpm dev`
then launches it via `agent`'s own `dev` script (`uvicorn agent.main:app --reload --port 8788`).

Single-package commands: `pnpm --filter web <script>`, `pnpm --filter api <script>`.

Secrets live in `api/.env`, `web/.env`, and `agent/.env` — copy each `.env.example` and fill. The API
needs `GOOGLE_API_KEY`, Turnstile keys, `IP_SALT`, `ADMIN_TOKEN` (and optionally `GROQ_API_KEY`,
`OPENROUTER_API_KEY`, `AGENT_URL`). The agent needs `GOOGLE_API_KEY` (embeddings, required) plus at
least one chat provider key — `GROQ_API_KEY` (default) and/or `OPENROUTER_API_KEY`.

## Architecture

Three packages: two JS workspaces glued by pnpm + one standalone Python service.

- **`web/`** — Vite + React 18 SPA, two routes: `/` (public chat) and `/admin` (metrics dashboard, bearer-gated).
- **`api/`** — Hono on Node, SSE streaming. Owns the defensive layers + metrics; **proxies chat to the agent**. State in-memory except SQLite for metrics.
- **`agent/`** — Python FastAPI + LangGraph service (port 8788). Owns the RAG brain: routing, retrieval, grading, generation, semantic cache, and short-term memory. This is where all LLM/embedding calls happen.

### Request pipeline (`POST /api/chat` on the Hono API)

`turnstileMiddleware` → `rateLimitMiddleware` → `dailyCapMiddleware` → handler ([`api/src/routes/chat.ts`](api/src/routes/chat.ts)). Any failure short-circuits with JSON error. The handler:

1. Validates the body, resolves the requested model against `api/src/llm/registry.ts`, and enforces a per-model rate limit.
2. Enriches IP locally with `geoip-lite` + `ua-parser-js` (no external calls); upserts a row in `visitors` keyed by `SHA256(ip + IP_SALT)` — IPs are never stored in clear; increments the daily counter.
3. **Proxies** to the Python agent at `${AGENT_URL}/chat` (default `http://127.0.0.1:8788`), forwarding `messages`, `lang`, `session_id` (= the IP hash), and the resolved `provider` / `provider_model_id` / `strip_thinking`.
4. Pipes the agent's SSE stream straight back to the browser, sniffing the `done` event to record `cache_hit`, then logs a row in `queries` (question, visitor_id, browser/OS/device, lang, cache_hit, status, model).

The Hono API does **no** embedding/retrieval/LLM work of its own — those live in the agent. (`api/src/rag/*` and `api/src/llm/gemini.ts` are legacy from the pre-agent design; the live retrieval path is the Python one.)

### Agent pipeline (LangGraph: router → rag → grader → generator)

Defined in [`agent/agent/graph.py`](agent/agent/graph.py); the FastAPI endpoint is [`agent/agent/main.py`](agent/agent/main.py):

1. **Router** ([`nodes/router.py`](agent/agent/nodes/router.py)) — classifies the last message `rag` (anything about Roberto, incl. contact/email/LinkedIn) vs `direct` (greetings, meta, off-topic). A deterministic contact-intent guard (`_is_contact_query`) runs first and forces `rag` for contact questions: the LLM router misroutes paraphrases like "get in touch" to `direct`, which would skip retrieval and make the generator decline. The guard only forces the *route* — the contact answer is still generated from the retrieved CV chunk, never hardcoded. `direct` skips retrieval; the generator answers/declines from the system prompt alone.
2. **RAG** ([`nodes/rag.py`](agent/agent/nodes/rag.py)) — embeds the message (Gemini `gemini-embedding-001`, 768-d), checks the in-memory **semantic cache** ([`cache/semantic_cache.py`](agent/agent/cache/semantic_cache.py): LRU 100, cosine ≥ 0.92, TTL 24h), else retrieves top-`RAG_TOP_K` chunks from `index.json` whose cosine ≥ `RAG_MIN_SCORE`.
3. **Grader** ([`nodes/grader.py`](agent/agent/nodes/grader.py)) — **grades each retrieved chunk individually** (Corrective-RAG style, concurrent via `asyncio.gather`) and keeps only the relevant ones. `context_relevant = (any kept)`. Per-chunk grading is deliberate: a single relevant passage was getting drowned when concatenated with several longer unrelated chunks and a small grader model returned `not_relevant`. This is the load-bearing precision gate now, so don't fold it back into one bulk call.
4. **Generator** ([`nodes/generator.py`](agent/agent/nodes/generator.py)) — streams the answer from the relevant chunks (or "no context available" → "I don't have that information"), then stores the answer in the semantic cache. System prompt is ported verbatim from `api/src/llm/prompt.ts`.

**Retrieval thresholds** ([`agent/agent/config.py`](agent/agent/config.py), env-tunable): `RAG_MIN_SCORE` (default **0.35**) and `RAG_TOP_K` (default **3**). The floor is a *recall* guard (drops only noise); **relevance is decided by the grader, not by a cosine cutoff** — that's why it's low. Don't treat `RAG_MIN_SCORE` as a relevance knob: scores for this corpus cluster tightly (~0.47–0.63), so any absolute floor in that band silently drops relevant chunks. See [`agent/agent/rag/retriever.py`](agent/agent/rag/retriever.py).

### RAG ingest (offline, run manually)

`pnpm ingest` walks `doc/**/*.{pdf,md,txt}`, extracts text (`pdf-parse` for PDFs), chunks at ≈1800 chars with 200 overlap, batches embeddings (100 per call), writes `api/src/rag/index.json`. Commit the generated JSON — there is no runtime regeneration. The agent loads this same file at boot (`RAG_INDEX_PATH`, default `../api/src/rag/index.json`).

**`doc/contact.md` is load-bearing, not redundant with the CV.** Contact details inside the CV PDF are (a) diluted — buried in a 1800-char header/bio chunk that ranks ~3rd for contact queries, sometimes falling out of `RAG_TOP_K`, and (b) corrupted — PDF extraction mangles the LinkedIn slug (`linkedin.com/in/robe rto rgzfdz`). `contact.md` is a tiny, contact-dense, clean, bilingual file that ingests to its **own** chunk; it ranks #1 by a wide margin for contact queries in both languages, so the "how do I contact him?" quick-action answers reliably. It is the canonical clean source for contact data — keep it in sync if the details change. Don't delete it.

### Models & providers

The agent is **multi-provider**; the dispatcher is [`agent/agent/llm/chat.py`](agent/agent/llm/chat.py) (`groq` / `gemini` / `openrouter`). Which chat model serves a request is chosen by the **API's** model registry ([`api/src/llm/registry.ts`](api/src/llm/registry.ts)) and forwarded as `provider` + `provider_model_id`.

- **Chat (generator)**: whatever the registry resolves — default is a Groq model (e.g. `llama-3.1-8b-instant`). Groq free tier is **6000 TPM** per model; the grader multiplies LLM calls by `RAG_TOP_K`, so keep `RAG_TOP_K` small.
- **Router + grader**: pinned to Groq `llama-3.1-8b-instant` when `GROQ_API_KEY` is set (fast/cheap), else they fall back to the request's provider/model. See `_routing_provider` / `_grading_provider`.
- **Embeddings**: Gemini `gemini-embedding-001` at `outputDimensionality: 768` ([`agent/agent/llm/embed.py`](agent/agent/llm/embed.py)). The default 3072-d would 4× the size of `index.json` with no accuracy gain for this corpus. Keep chunk and query embeddings on the same model + dimensionality or cosine scores become meaningless. `pnpm --filter api list-models` lists Gemini IDs the current key can call.

### Defensive layers — all are load-bearing

| Layer | Where | Purpose |
|-------|-------|---------|
| Cloudflare Turnstile (invisible) | `middleware/turnstile.ts` + `hooks/useTurnstile.ts` | Bot challenge on every request |
| Rate limit per IP | `middleware/rateLimit.ts` | In-memory Maps: 5/min + 30/day (env-tunable) |
| Daily hard cap | `middleware/dailyCap.ts` | Reads SQLite `daily_counter` on every request (fast in-process read); over cap → 503 + frontend swaps to `FallbackFaq` |
| Semantic cache | `agent/agent/cache/semantic_cache.py` | Repeated paraphrases (cosine ≥ 0.92) cost 0 tokens |

### Admin surface (`/admin`)

Bearer-authenticated (`ADMIN_TOKEN`, stored in `sessionStorage`). Read-only views: stats cards (24h/7d/30d), visitors table, visitor detail with timeline, queries with LIKE search, top questions, country breakdown. No external chart libs — CSS bars and semantic tables only.

## Non-negotiable constraints

- **No AWS-specific code in the API or agent** (no `aws-sdk`, RDS, S3, Secrets Manager). State must stay in `data/metrics.db` + `.env` so a migration to Oracle/Pi/self-host is `scp` + `systemctl`.
- **No paid SaaS on the hot path.** Groq / Gemini / OpenRouter (free tiers), Turnstile (free), SQLite (local), `geoip-lite` (bundled). Anything else needs an explicit decision. Mind free-tier ceilings (Groq 6000 TPM/model) when adding per-request LLM calls.
- **IPs never stored in clear.** Always hash with `IP_SALT` before persisting.
- **i18n is home-grown** (`web/src/i18n/`). Do not add `react-i18next` or similar.
- **No Inter / Roboto / Arial / Space Grotesk** in the UI — typography is Fraunces + JetBrains Mono (editorial dark aesthetic).
- The LLM always replies in the language of the user's question, regardless of UI toggle (enforced by the agent's generator system prompt, ported from `api/src/llm/prompt.ts`). Do not route responses through the UI `lang`.
- **Relevance is the grader's job, not a similarity threshold.** Keep `RAG_MIN_SCORE` low (recall-only); never raise it to filter relevance — it silently drops chunks in this corpus's tight score band.

## Deployment target

AWS EC2 t4g.micro (ARM, free tier 12mo) runs **both** the Hono API and the Python agent behind Caddy (API proxies to the agent over localhost:8788); Cloudflare Pages for `web/dist`. Everything ARM-compatible (better-sqlite3 has prebuilt linux-arm64 binaries; the agent is pure-Python + numpy). Backups via EBS snapshots configured in the AWS console — no code required.

## Installed Claude skills

- `frontend-design` (`.agents/skills/frontend-design/`) — invoke before writing any UI. Enforces bold aesthetic commitment, distinctive typography, staggered motion, textured backgrounds.
- `find-skills` — invoke when asked "how do I do X" or to extend agent capabilities. Commands: `npx skills find <query>`, `npx skills add <owner/repo@skill>`, `npx skills check`, `npx skills update`. Verify install count (prefer 1K+) before recommending.
