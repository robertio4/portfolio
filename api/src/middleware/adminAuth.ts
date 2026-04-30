import { timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

export const adminAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const auth = c.req.header('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m || !safeEqual(m[1]!, env.ADMIN_TOKEN)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}
