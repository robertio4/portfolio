import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { embedText } from '../llm/gemini.js';
import { SYSTEM_PROMPT, buildContext } from '../llm/prompt.js';
import { MODEL_REGISTRY, DEFAULT_MODEL, findModel, toPublic } from '../llm/registry.js';
import { getAdapter } from '../llm/adapters/index.js';
import { retrieve } from '../rag/retrieve.js';
import * as cache from '../rag/semanticCache.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { dailyCapMiddleware } from '../middleware/dailyCap.js';
import { turnstileMiddleware, getClientIp, type ChatVariables } from '../middleware/turnstile.js';
import { checkModelRateLimit } from '../middleware/modelRateLimit.js';
import { hashIp, lookupGeo, parseUA } from '../metrics/geo.js';
import { upsertVisitor, insertQuery, incrementDaily, todayKey } from '../metrics/log.js';
import { log, newRequestId } from '../lib/logger.js';

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

  let queryEmb: number[];
  try {
    queryEmb = await embedText(lastUser.content);
  } catch (err) {
    log.error('embed_failed', { rid, err: (err as Error).message });
    insertQuery({
      ts: now,
      visitorId,
      question: lastUser.content,
      lang,
      ua,
      referrer,
      cacheHit: false,
      status: 502,
      model: modelEntry.id,
    });
    return c.json({ error: 'embed_failed' }, 502);
  }

  const cached = cache.lookup(queryEmb, lang);
  if (cached) {
    insertQuery({
      ts: now,
      visitorId,
      question: lastUser.content,
      lang,
      ua,
      referrer,
      cacheHit: true,
      status: 200,
      model: modelEntry.id,
    });
    return streamSSE(c, async (stream) => {
      for (const word of cached.split(/(\s+)/)) {
        await stream.writeSSE({ event: 'delta', data: JSON.stringify({ delta: word }) });
        await stream.sleep(10);
      }
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ cached: true }) });
    });
  }

  const top = retrieve(queryEmb, 5);
  const context = buildContext(top);
  const systemInstruction = `${SYSTEM_PROMPT}\n\n=== Contexto sobre Roberto ===\n${context}`;

  const contents = messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    text: m.content,
  }));

  const adapter = getAdapter(modelEntry.provider);

  return streamSSE(c, async (stream) => {
    let fullAnswer = '';
    let status = 200;
    try {
      for await (const delta of adapter.stream({
        providerModelId: modelEntry.providerModelId,
        contents,
        systemInstruction,
        maxTokens: 600,
        temperature: 0.4,
      })) {
        fullAnswer += delta;
        await stream.writeSSE({ event: 'delta', data: JSON.stringify({ delta }) });
      }
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ cached: false }) });
    } catch (err) {
      status = 502;
      log.error('llm_failed', { rid, model: modelEntry.id, err: (err as Error).message });
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ message: 'llm_failed', rid }),
      });
    } finally {
      if (fullAnswer.trim().length > 0) {
        cache.store({
          embedding: queryEmb,
          question: lastUser.content,
          answer: fullAnswer,
          ts: Date.now(),
          lang,
        });
      }
      insertQuery({
        ts: now,
        visitorId,
        question: lastUser.content,
        lang,
        ua,
        referrer,
        cacheHit: false,
        status,
        model: modelEntry.id,
      });
    }
  });
});
