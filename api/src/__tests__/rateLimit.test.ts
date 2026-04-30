import './_setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { rateLimitMiddleware } from '../middleware/rateLimit.js';

function buildApp() {
  const app = new Hono();
  app.post('/', rateLimitMiddleware, (c) => c.json({ ok: true }));
  return app;
}

function fire(app: Hono, ip: string) {
  return app.fetch(
    new Request('http://test.local/', {
      method: 'POST',
      headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
}

test('rateLimit: first 5 requests pass, 6th returns 429 rate_limit_minute', async () => {
  const app = buildApp();
  const ip = '10.0.0.1'; // unique to this test

  for (let i = 0; i < 5; i++) {
    const res = await fire(app, ip);
    assert.equal(res.status, 200, `request ${i + 1} should pass`);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  }

  const sixth = await fire(app, ip);
  assert.equal(sixth.status, 429);
  const body = (await sixth.json()) as { error: string; retryIn: number };
  assert.equal(body.error, 'rate_limit_minute');
  assert.equal(body.retryIn, 60);
});

test('rateLimit: separate IPs have independent buckets', async () => {
  const app = buildApp();
  const ipA = '10.0.0.2';
  const ipB = '10.0.0.3';

  // Burn ipA's bucket
  for (let i = 0; i < 5; i++) {
    const res = await fire(app, ipA);
    assert.equal(res.status, 200);
  }
  const blocked = await fire(app, ipA);
  assert.equal(blocked.status, 429);

  // ipB should still pass
  const res = await fire(app, ipB);
  assert.equal(res.status, 200);
});

test('rateLimit: default IP (127.0.0.1) used when no proxy headers', async () => {
  const app = new Hono();
  app.post('/', rateLimitMiddleware, (c) => c.json({ ok: true }));
  // No cf-connecting-ip header — falls back to 127.0.0.1.
  // We can only assert it doesn't crash and returns 200 once.
  const res = await app.fetch(
    new Request('http://test.local/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(res.status, 200);
});
