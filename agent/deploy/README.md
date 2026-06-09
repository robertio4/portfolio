# Deploying the agent to EC2

The agent runs on the same EC2 t4g.micro as the Hono API. The API proxies chat to
it over `localhost:8788` (`AGENT_URL`, default `http://127.0.0.1:8788`), so the
agent is internal — Caddy and Cloudflare Pages need no changes for it.

Code reaches the box via `git pull`. Secrets (`*/.env`) are gitignored and must be
created on the box. `doc/` is gitignored too, but the agent doesn't need it: its
chunks are already embedded in `api/src/rag/index.json` (which is committed).

## First deployment (one-time)

**Local:**
```bash
git add -A && git commit -m "deploy agent" && git push origin main
```

**On EC2 (instance powered on):**
```bash
cd ~/portfolio && git pull origin main

# API (now proxies to the agent) — rebuild + restart
pnpm install && pnpm build
sudo systemctl restart portfolio-api      # your existing API unit

# Agent (new) — Python 3.11, ARM64
cd agent
curl -LsSf https://astral.sh/uv/install.sh | sh   # if uv not installed
uv sync
cp .env.example .env                       # fill GOOGLE_API_KEY (required) + GROQ_API_KEY

# Run as a service
sudo cp deploy/portfolio-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now portfolio-agent
```

**Verify:**
```bash
curl -s localhost:8788/health             # {"ok":true,"index_size":7}
```
Then exercise the public chat with "¿Cómo le contacto?" / "How do I get in touch?".

## Subsequent updates

```bash
# local: if you re-ran `pnpm ingest`, commit the regenerated index.json first
git push origin main
# EC2:
git pull origin main
sudo systemctl restart portfolio-agent     # + portfolio-api only if you changed the API
```

The agent reloads `index.json` at boot, so a restart is what applies a re-ingest
(e.g. updated `doc/contact.md` or CV).
