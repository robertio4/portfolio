import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { allowedOrigins, env } from './env.js';
import { chatRoute } from './routes/chat.js';
import { adminRoute } from './routes/admin.js';
import { initDb } from './metrics/db.js';
import { loadIndex } from './rag/retrieve.js';

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => (origin && allowedOrigins.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  }),
);

app.get('/health', (c) => c.json({ ok: true }));
app.route('/chat', chatRoute);
app.route('/admin', adminRoute);

// Boot order: DB schema must be ready, RAG index loaded into memory.
initDb();
loadIndex();

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});
