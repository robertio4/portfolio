import { Hono } from 'hono';
import { z } from 'zod';
import { MODEL_REGISTRY, DEFAULT_MODEL, findModel, toPublic } from '../llm/registry.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { dailyCapMiddleware } from '../middleware/dailyCap.js';
import { turnstileMiddleware, getClientIp, type ChatVariables } from '../middleware/turnstile.js';
import { checkModelRateLimit } from '../middleware/modelRateLimit.js';
import { hashIp, lookupGeo, parseUA } from '../metrics/geo.js';
import { upsertVisitor, insertQuery, incrementDaily, todayKey } from '../metrics/log.js';
import { log, newRequestId } from '../lib/logger.js';
import { env } from '../env.js';

const messageSchema = z
  .object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000),
  })
  .strict();

const bodySchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(40),
    lang: z.enum(['es', 'en']).default('es'),
    turnstileToken: z.string().min(1),
    model: z.string().optional(),
  })
  .strict();

export type ChatRequestBody = z.infer<typeof bodySchema>;

export const chatRoute = new Hono<{ Variables: ChatVariables }>();

// GET /chat/models — returns public model list, no auth required
chatRoute.get('/models', (c) => {
  return c.json(MODEL_REGISTRY.map(toPublic));
});

chatRoute.post('/', turnstileMiddleware, rateLimitMiddleware, dailyCapMiddleware, async (c) => {
  const rid = newRequestId();
  const stashed = c.get('rawBody');
  const raw = stashed ?? (await c.req.json());
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.flatten() }, 400);
  }
  const { messages, lang } = parsed.data;
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) return c.json({ error: 'no_user_message' }, 400);

  // Resolve model from request or default
  const rawModelId = parsed.data.model ?? DEFAULT_MODEL.id;
  const modelEntry = findModel(rawModelId);
  if (!modelEntry) {
    return c.json({ error: 'unknown_model', model: rawModelId }, 400);
  }

  const ip = getClientIp(c);

  const limitError = checkModelRateLimit(ip, modelEntry.id);
  if (limitError) {
    return c.json(limitError, 429);
  }

  const ipHash = hashIp(ip);
  const geo = lookupGeo(ip);
  const ua = parseUA(c.req.header('user-agent'));
  const referrer = c.req.header('referer') ?? null;
  const now = Date.now();
  const visitorId = upsertVisitor({ ipHash, geo, now });
  incrementDaily(todayKey(now));

  // ── Proxy to Python LangGraph agent ──────────────────────────────────────
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(`${env.AGENT_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        lang,
        session_id: ipHash,
        provider: modelEntry.provider,
        provider_model_id: modelEntry.providerModelId,
        strip_thinking: modelEntry.stripThinking ?? false,
      }),
    });
  } catch (err) {
    log.error('agent_unreachable', { rid, err: (err as Error).message });
    insertQuery({ ts: now, visitorId, question: lastUser.content, lang, ua, referrer, cacheHit: false, status: 502, model: modelEntry.id });
    return c.json({ error: 'agent_unreachable' }, 502);
  }

  if (!upstreamRes.ok || !upstreamRes.body) {
    log.error('agent_error', { rid, status: upstreamRes.status });
    insertQuery({ ts: now, visitorId, question: lastUser.content, lang, ua, referrer, cacheHit: false, status: 502, model: modelEntry.id });
    return c.json({ error: 'agent_error' }, 502);
  }

  // Forward the SSE stream straight through; sniff the done event to log cache_hit
  let cacheHit = false;
  const decoder = new TextDecoder();
  const passthrough = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      if (text.includes('"cached":true')) cacheHit = true;
      controller.enqueue(chunk);
    },
    flush() {
      insertQuery({ ts: now, visitorId, question: lastUser.content, lang, ua, referrer, cacheHit, status: 200, model: modelEntry.id });
    },
  });

  upstreamRes.body.pipeTo(passthrough.writable).catch((err) => {
    log.error('stream_pipe_error', { rid, err: (err as Error).message });
  });

  return new Response(passthrough.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
