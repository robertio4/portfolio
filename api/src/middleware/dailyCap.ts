import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { getDaily, todayKey } from '../metrics/log.js';

let cachedDate = '';
let cachedCount = 0;

export const dailyCapMiddleware: MiddlewareHandler = async (c, next) => {
  const date = todayKey();
  if (date !== cachedDate) {
    cachedDate = date;
    cachedCount = getDaily(date);
  }
  if (cachedCount >= env.DAILY_CAP) {
    return c.json({ error: 'daily_cap_reached', cap: env.DAILY_CAP }, 503);
  }
  await next();
};

export function bumpDailyCache(): void {
  cachedCount += 1;
}

export function resetDailyCache(): void {
  cachedDate = '';
  cachedCount = 0;
}
