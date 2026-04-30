import './_setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

// _setupEnv sets ADMIN_TOKEN='testtoken1234'.
const TOKEN = 'testtoken1234';

function buildApp() {
  const app = new Hono();
  app.get('/admin/x', adminAuthMiddleware, (c) => c.json({ ok: true }));
  return app;
}

function fire(headers: Record<string, string> = {}) {
  return buildApp().fetch(new Request('http://test.local/admin/x', { method: 'GET', headers }));
}

test('adminAuth: missing Authorization header -> 401', async () => {
  const res = await fire();
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthorized');
});

test('adminAuth: malformed header (no Bearer) -> 401', async () => {
  const res = await fire({ authorization: TOKEN });
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthorized');
});

test('adminAuth: wrong token (same length) -> 401', async () => {
  const wrong = 'wrongtoken12'; // 12 chars, same length as 'testtoken1234'? No, 'testtoken1234' is 13.
  // Build a same-length wrong token to exercise timingSafeEqual on equal-length buffers.
  const sameLen = 'x'.repeat(TOKEN.length);
  assert.equal(sameLen.length, TOKEN.length);
  const res = await fire({ authorization: `Bearer ${sameLen}` });
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthorized');
  // Also try a totally wrong token.
  const res2 = await fire({ authorization: `Bearer ${wrong}` });
  assert.equal(res2.status, 401);
});

test('adminAuth: different-length token -> 401 (no throw on length mismatch)', async () => {
  const res = await fire({ authorization: 'Bearer short' });
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthorized');

  // Way longer too.
  const res2 = await fire({ authorization: `Bearer ${'a'.repeat(500)}` });
  assert.equal(res2.status, 401);
});

test('adminAuth: correct token -> 200 (next runs)', async () => {
  const res = await fire({ authorization: `Bearer ${TOKEN}` });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean };
  assert.equal(body.ok, true);
});

test('adminAuth: case-insensitive Bearer prefix -> 200', async () => {
  const res = await fire({ authorization: `bearer ${TOKEN}` });
  assert.equal(res.status, 200);
});
