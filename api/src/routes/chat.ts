import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
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

const errorSchema = z.object({ error: z.string() });

const publicModelSchema = z.object({
  id: z.string(),
  provider: z.enum(['gemini', 'groq', 'openrouter']),
  label: z.string(),
  description: z.object({ en: z.string(), es: z.string() }),
  limits: z.object({ rpm: z.number(), rpd: z.number() }),
  isDefault: z.boolean().optional(),
});

const modelsRoute = createRoute({
  method: 'get',
  path: '/models',
  summary: 'List available LLM models',
  tags: ['Chat'],
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(publicModelSchema) } },
      description: 'Available models',
    },
  },
});

const chatRoute = createRoute({
  method: 'post',
  path: '/',
  summary: 'Send a chat message',
  description: 'Streams the response as Server-Sent Events (text/event-stream). Events: `delta` (text chunk) and `done` (with `cached: boolean`).',
  tags: ['Chat'],
  request: {
    body: {
      content: { 'application/json': { schema: bodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'text/event-stream': { schema: z.string() } },
      description: 'SSE stream — `event: delta` chunks then `event: done`',
    },
    400: { content: { 'application/json': { schema: errorSchema } }, description: 'Invalid request' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: 'Turnstile failed' },
    429: { content: { 'application/json': { schema: errorSchema } }, description: 'Rate limit exceeded' },
    502: { content: { 'application/json': { schema: errorSchema } }, description: 'Agent unreachable or failed' },
    503: { content: { 'application/json': { schema: errorSchema } }, description: 'Daily cap reached' },
  },
});

export const chatRouter = new OpenAPIHono<{ Variables: ChatVariables }>();

chatRouter.openapi(modelsRoute, (c) => {
  return c.json(MODEL_REGISTRY.map(toPublic));
});

chatRouter.use('/', turnstileMiddleware, rateLimitMiddleware, dailyCapMiddleware);

chatRouter.openapi(chatRoute, async (c) => {
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
