import { Hono } from 'hono';
import { z } from 'zod';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import {
  statsFor,
  listVisitors,
  getVisitor,
  visitorQueries,
  searchQueries,
  topQueries,
  type Range,
} from '../metrics/queries.js';

export const adminRoute = new Hono();
adminRoute.use('*', adminAuthMiddleware);

const rangeSchema = z.enum(['24h', '7d', '30d']).default('24h');

adminRoute.get('/stats', (c) => {
  const range = rangeSchema.parse(c.req.query('range') ?? '24h') as Range;
  return c.json(statsFor(range));
});

adminRoute.get('/visitors', (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  return c.json({ visitors: listVisitors(limit) });
});

adminRoute.get('/visitors/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: 'invalid_id' }, 400);
  const visitor = getVisitor(id);
  if (!visitor) return c.json({ error: 'not_found' }, 404);
  const queries = visitorQueries(id, 200);
  return c.json({ visitor, queries });
});

adminRoute.get('/queries', (c) => {
  const q = c.req.query('q') ?? null;
  const limit = Math.min(Number(c.req.query('limit') ?? 100), 500);
  return c.json({ queries: searchQueries(q, limit) });
});

adminRoute.get('/top-queries', (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  return c.json({ queries: topQueries(limit) });
});
