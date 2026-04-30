import './_setupEnv.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, retrieve, isIndexLoaded, indexSize, getChunks } from '../rag/retrieve.js';

test('cosine: identical vectors -> 1', () => {
  const v = [1, 2, 3, 4];
  assert.equal(cosine(v, v), 1);
});

test('cosine: opposite vectors -> -1', () => {
  const a = [1, 2, 3];
  const b = [-1, -2, -3];
  assert.equal(cosine(a, b), -1);
});

test('cosine: orthogonal vectors -> 0', () => {
  const a = [1, 0, 0, 0];
  const b = [0, 1, 0, 0];
  assert.equal(cosine(a, b), 0);
});

test('cosine: zero vector -> 0 (no division by zero)', () => {
  const a = [0, 0, 0];
  const b = [1, 2, 3];
  assert.equal(cosine(a, b), 0);
});

test('cosine: unit-normalized vectors equal their dot product', () => {
  const raw = [3, 4]; // length 5
  const norm = raw.map((x) => x / 5); // unit vector [0.6, 0.8]
  const other = [0.6, 0.8]; // also unit
  const cos = cosine(norm, other);
  // dot product of unit vectors == cosine
  const dot = norm[0]! * other[0]! + norm[1]! * other[1]!;
  assert.ok(Math.abs(cos - dot) < 1e-12, `cosine ${cos} should equal dot ${dot}`);
  assert.equal(cos, 1);
});

test('cosine: similar but non-identical vectors -> in (0,1)', () => {
  const a = [1, 1, 0, 0];
  const b = [1, 0, 0, 0];
  const score = cosine(a, b);
  assert.ok(score > 0 && score < 1, `expected 0 < ${score} < 1`);
  assert.ok(Math.abs(score - 1 / Math.sqrt(2)) < 1e-12);
});

test('cosine: handles different lengths by truncating to min', () => {
  const a = [1, 0, 999];
  const b = [1, 0];
  // Truncated to length 2 → identical → cosine 1
  assert.equal(cosine(a, b), 1);
});

test('retrieve: returns up to k results sorted by score descending', () => {
  // Use an actual corpus vector so similarity > MIN_SCORE threshold.
  const corpusChunks = getChunks();
  assert.ok(corpusChunks.length > 0, 'index must be non-empty for this test');
  const v = corpusChunks[0]!.vector;

  const k = 3;
  const results = retrieve(v, k);
  assert.ok(isIndexLoaded(), 'index should be loaded after first retrieve()');

  // A chunk vector must match itself with score ~1.0, well above MIN_SCORE.
  assert.ok(results.length > 0, 'expected at least one result');
  assert.ok(results.length <= k, `expected at most ${k} results, got ${results.length}`);

  // Sorted descending.
  for (let i = 1; i < results.length; i++) {
    assert.ok(
      results[i - 1]!.score >= results[i]!.score,
      `expected descending: ${results[i - 1]!.score} >= ${results[i]!.score}`,
    );
  }

  // Each result wraps a chunk with id/text/vector.
  for (const r of results) {
    assert.ok(typeof r.chunk.id === 'string');
    assert.ok(typeof r.chunk.text === 'string');
    assert.ok(Array.isArray(r.chunk.vector));
  }
});

test('retrieve: k=0 returns empty array', () => {
  const v = new Array(768).fill(0).map((_, i) => Math.cos(i));
  const results = retrieve(v, 0);
  assert.equal(results.length, 0);
});

test('retrieve: indexSize > 0 after load', () => {
  // Trigger load if not yet loaded.
  retrieve(new Array(768).fill(0.001), 1);
  assert.ok(indexSize() > 0, 'expected non-empty corpus index');
});
