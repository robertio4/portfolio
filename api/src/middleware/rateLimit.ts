import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { getClientIp } from './turnstile.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const minute = new Map<string, Bucket>();
const day = new Map<string, Bucket>();

function hit(bucket: Map<string, Bucket>, ip: string, windowMs: number, limit: number): boolean {
  const now = Date.now();
  const cur = bucket.get(ip);
  if (!cur || cur.resetAt < now) {
    bucket.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  cur.count += 1;
  return cur.count <= limit;
}

export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  const ip = getClientIp(c);
  if (!hit(minute, ip, 60_000, env.RL_PER_MIN)) {
    return c.json({ error: 'rate_limit_minute', retryIn: 60 }, 429);
  }
  if (!hit(day, ip, 86_400_000, env.RL_PER_DAY)) {
    return c.json({ error: 'rate_limit_day' }, 429);
  }
  await next();
};
