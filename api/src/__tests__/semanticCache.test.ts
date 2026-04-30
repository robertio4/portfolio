import './_setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookup, store, clear, size } from '../rag/semanticCache.js';

function unitVec(seed: number, dim = 8): number[] {
  // Deterministic non-zero vector. Different seeds → orthogonal-ish vectors when seed differs significantly.
  const v = new Array(dim).fill(0).map((_, i) => Math.sin(seed * (i + 1)));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

test('semanticCache: store + lookup with same vector returns cached answer', () => {
  clear();
  const v = unitVec(1);
  store({ embedding: v, question: 'who?', answer: 'Roberto', ts: Date.now(), lang: 'en' });
  const hit = lookup(v, 'en');
  assert.equal(hit, 'Roberto');
});

test('semanticCache: orthogonal vector returns null', () => {
  clear();
  // Two basis-aligned vectors that are exactly orthogonal.
  const a = [1, 0, 0, 0];
  const b = [0, 1, 0, 0];
  store({ embedding: a, question: 'q', answer: 'A', ts: Date.now(), lang: 'en' });
  const hit = lookup(b, 'en');
  assert.equal(hit, null);
});

test('semanticCache: TTL expiry returns null after 25h', () => {
  clear();
  const v = unitVec(2);
  const stale = Date.now() - 25 * 60 * 60 * 1000; // 25h ago
  store({ embedding: v, question: 'q', answer: 'OldAnswer', ts: stale, lang: 'en' });
  const hit = lookup(v, 'en');
  assert.equal(hit, null);
});

test('semanticCache: language mismatch returns null', () => {
  clear();
  const v = unitVec(3);
  store({ embedding: v, question: 'quien?', answer: 'Roberto', ts: Date.now(), lang: 'es' });
  const hit = lookup(v, 'en');
  assert.equal(hit, null);
});

test('semanticCache: same lang same vector hits, different lang misses', () => {
  clear();
  const v = unitVec(4);
  store({ embedding: v, question: 'q', answer: 'A', ts: Date.now(), lang: 'es' });
  assert.equal(lookup(v, 'es'), 'A');
  assert.equal(lookup(v, 'en'), null);
});

test('semanticCache: clear empties the cache', () => {
  clear();
  store({ embedding: unitVec(5), question: 'q', answer: 'A', ts: Date.now(), lang: 'en' });
  assert.equal(size(), 1);
  clear();
  assert.equal(size(), 0);
});
