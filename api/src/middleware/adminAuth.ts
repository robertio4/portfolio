import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

export const adminAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m || m[1] !== env.ADMIN_TOKEN) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};
