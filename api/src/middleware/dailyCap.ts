import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { getDaily, todayKey } from '../metrics/log.js';

export const dailyCapMiddleware: MiddlewareHandler = async (c, next) => {
  const count = getDaily(todayKey());
  if (count >= env.DAILY_CAP) {
    return c.json({ error: 'daily_cap_reached', cap: env.DAILY_CAP }, 503);
  }
  await next();
};
