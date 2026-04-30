import './_setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { turnstileMiddleware } from '../middleware/turnstile.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface MockResp {
  success: boolean;
  errorCodes?: string[];
}

function installFetch(resp: MockResp | (() => MockResp), captured?: { calls: Array<{ url: string; body: string }> }) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as { url: string }).url;
    let bodyStr = '';
    if (init?.body instanceof URLSearchParams) bodyStr = init.body.toString();
    else if (typeof init?.body === 'string') bodyStr = init.body;
    captured?.calls.push({ url, body: bodyStr });
    const body = typeof resp === 'function' ? resp() : resp;
    return new Response(JSON.stringify({ success: body.success, 'error-codes': body.errorCodes ?? [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function buildApp() {
  const app = new Hono();
  app.post('/', turnstileMiddleware, (c) => c.json({ ok: true }));
  return app;
}

test('turnstile: missing token returns 403 turnstile_token_missing', async () => {
  const app = buildApp();
  const res = await app.fetch(
    new Request('http://test.local/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}), // no turnstileToken
    }),
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'turnstile_token_missing');
});

test('turnstile: non-JSON body returns 403 turnstile_token_missing', async () => {
  const app = buildApp();
  const res = await app.fetch(
    new Request('http://test.local/', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'not-json-at-all',
    }),
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'turnstile_token_missing');
});

test('turnstile: verify failure returns 403 turnstile_failed with codes', async () => {
  const restore = installFetch({ success: false, errorCodes: ['invalid-input-response'] });
  try {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://test.local/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ turnstileToken: 'badtoken' }),
      }),
    );
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error: string; codes: string[] };
    assert.equal(body.error, 'turnstile_failed');
    assert.deepEqual(body.codes, ['invalid-input-response']);
  } finally {
    restore();
  }
});

test('turnstile: verify success calls next handler', async () => {
  const captured = { calls: [] as Array<{ url: string; body: string }> };
  const restore = installFetch({ success: true }, captured);
  try {
    const app = buildApp();
    const res = await app.fetch(
      new Request('http://test.local/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.5' },
        body: JSON.stringify({ turnstileToken: 'goodtoken' }),
      }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean };
    assert.equal(body.ok, true);

    // Verify the upstream call was to the right URL with secret + response + remoteip.
    assert.equal(captured.calls.length, 1);
    assert.equal(captured.calls[0]!.url, VERIFY_URL);
    assert.match(captured.calls[0]!.body, /secret=test-turnstile-secret/);
    assert.match(captured.calls[0]!.body, /response=goodtoken/);
    assert.match(captured.calls[0]!.body, /remoteip=203.0.113.5/);
  } finally {
    restore();
  }
});
