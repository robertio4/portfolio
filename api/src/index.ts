import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { allowedOrigins, env } from './env.js';
import { chatRoute } from './routes/chat.js';
import { adminRoute } from './routes/admin.js';
import { initDb } from './metrics/db.js';
import { loadIndex, isIndexLoaded, indexSize } from './rag/retrieve.js';

const app = new Hono();
const startedAt = Date.now();

app.use('*', logger());
app.use(
  '*',
  secureHeaders({
    crossOriginResourcePolicy: 'same-site',
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
  }),
);
app.use(
  '*',
  cors({
    origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }),
);
app.use(
  '/chat/*',
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => c.json({ error: 'payload_too_large' }, 413),
  }),
);

app.get('/health', (c) =>
  c.json({
    ok: true,
    indexLoaded: isIndexLoaded(),
    chunks: indexSize(),
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  }),
);
app.route('/chat', chatRoute);
app.route('/admin', adminRoute);

// Boot order: DB schema must be ready, RAG index loaded into memory.
initDb();
loadIndex();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
