import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { ai, CHAT_MODEL, embedText } from '../llm/gemini.js';
import { SYSTEM_PROMPT, buildContext } from '../llm/prompt.js';
import { retrieve } from '../rag/retrieve.js';
import * as cache from '../rag/semanticCache.js';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';
import { dailyCapMiddleware } from '../middleware/dailyCap.js';
import { turnstileMiddleware, getClientIp, type ChatVariables } from '../middleware/turnstile.js';
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
  })
  .strict();

export type ChatRequestBody = z.infer<typeof bodySchema>;

export const chatRoute = new Hono<{ Variables: ChatVariables }>();

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

  const ip = getClientIp(c);
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

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  return streamSSE(c, async (stream) => {
    let fullAnswer = '';
    let status = 200;
    try {
      const result = await ai.models.generateContentStream({
        model: CHAT_MODEL,
        contents,
        config: {
          systemInstruction: `${SYSTEM_PROMPT}\n\n=== Contexto sobre Roberto ===\n${context}`,
          maxOutputTokens: 600,
          temperature: 0.4,
        },
      });
      for await (const chunk of result) {
        const delta = chunk.text;
        if (!delta) continue;
        fullAnswer += delta;
        await stream.writeSSE({ event: 'delta', data: JSON.stringify({ delta }) });
      }
      await stream.writeSSE({ event: 'done', data: JSON.stringify({ cached: false }) });
    } catch (err) {
      status = 502;
      log.error('gemini_failed', { rid, err: (err as Error).message });
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
      });
    }
  });
});
