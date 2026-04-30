import './_setupEnv.js';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { dailyCapMiddleware } from '../middleware/dailyCap.js';
import { env } from '../env.js';
import { initDb } from '../metrics/db.js';
import { incrementDaily, todayKey, getDaily } from '../metrics/log.js';

initDb();

function buildApp() {
  const app = new Hono();
  app.post('/', dailyCapMiddleware, (c) => c.json({ ok: true }));
  return app;
}

function fire(app: Hono) {
  return app.fetch(
    new Request('http://test.local/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
}

test('dailyCap: passes when count is below cap', async () => {
  // In-memory DB starts empty, count is 0.
  const app = buildApp();
  const res = await fire(app);
  assert.equal(res.status, 200);
});

test('dailyCap: returns 503 daily_cap_reached when count >= cap', async () => {
  // Seed to exactly env.DAILY_CAP (the real parsed value) so the check triggers.
  const today = todayKey();
  while (getDaily(today) < env.DAILY_CAP) {
    incrementDaily(today);
  }
  assert.equal(getDaily(today), env.DAILY_CAP);

  const app = buildApp();
  const res = await fire(app);
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error: string; cap: number };
  assert.equal(body.error, 'daily_cap_reached');
  assert.equal(body.cap, env.DAILY_CAP);
});

test('dailyCap: incrementDaily returns running count', () => {
  // Use a unique far-future date keyed by test run timestamp to avoid any state.
  const future = `9999-${String(Date.now()).slice(-5)}-01`;
  assert.equal(incrementDaily(future), 1);
  assert.equal(incrementDaily(future), 2);
  assert.equal(getDaily(future), 2);
});
