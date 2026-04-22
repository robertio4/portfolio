import { db } from './db.js';

export type Range = '24h' | '7d' | '30d';

const rangeMs: Record<Range, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function since(range: Range): number {
  return Date.now() - rangeMs[range];
}

export function statsFor(range: Range) {
  const from = since(range);
  const total = db
    .prepare<[number], { c: number }>('SELECT COUNT(*) AS c FROM queries WHERE ts >= ?')
    .get(from)?.c ?? 0;
  const uniqueVisitors = db
    .prepare<[number], { c: number }>(
      'SELECT COUNT(DISTINCT visitor_id) AS c FROM queries WHERE ts >= ?',
    )
    .get(from)?.c ?? 0;
  const cacheHits = db
    .prepare<[number], { c: number }>(
      'SELECT COUNT(*) AS c FROM queries WHERE ts >= ? AND cache_hit = 1',
    )
    .get(from)?.c ?? 0;
  const langs = db
    .prepare<[number], { lang: string; c: number }>(
      'SELECT lang, COUNT(*) AS c FROM queries WHERE ts >= ? GROUP BY lang',
    )
    .all(from);
  const countries = db
    .prepare<[number], { country: string; c: number }>(
      `SELECT v.country AS country, COUNT(*) AS c
       FROM queries q JOIN visitors v ON v.id = q.visitor_id
       WHERE q.ts >= ? AND v.country IS NOT NULL
       GROUP BY v.country ORDER BY c DESC LIMIT 10`,
    )
    .all(from);

  return {
    range,
    totalQueries: total,
    uniqueVisitors,
    cacheHitRate: total > 0 ? cacheHits / total : 0,
    languages: langs,
    topCountries: countries,
  };
}

export function listVisitors(limit = 100) {
  return db
    .prepare(
      `SELECT id, ip_hash, country, region, city, isp,
              first_seen, last_seen, total_questions
       FROM visitors ORDER BY last_seen DESC LIMIT ?`,
    )
    .all(limit);
}

export function getVisitor(id: number) {
  return db
    .prepare(
      `SELECT id, ip_hash, country, region, city, isp,
              first_seen, last_seen, total_questions
       FROM visitors WHERE id = ?`,
    )
    .get(id);
}

export function visitorQueries(visitorId: number, limit = 200) {
  return db
    .prepare(
      `SELECT id, ts, question, lang, browser, os, device, referrer, cache_hit, status
       FROM queries WHERE visitor_id = ? ORDER BY ts DESC LIMIT ?`,
    )
    .all(visitorId, limit);
}

export function searchQueries(q: string | null, limit = 100) {
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    return db
      .prepare(
        `SELECT q.id, q.ts, q.visitor_id, q.question, q.lang, q.browser, q.os, q.device,
                q.cache_hit, q.status, v.country, v.city
         FROM queries q JOIN visitors v ON v.id = q.visitor_id
         WHERE q.question LIKE ? ORDER BY q.ts DESC LIMIT ?`,
      )
      .all(like, limit);
  }
  return db
    .prepare(
      `SELECT q.id, q.ts, q.visitor_id, q.question, q.lang, q.browser, q.os, q.device,
              q.cache_hit, q.status, v.country, v.city
       FROM queries q JOIN visitors v ON v.id = q.visitor_id
       ORDER BY q.ts DESC LIMIT ?`,
    )
    .all(limit);
}

export function topQueries(limit = 20) {
  return db
    .prepare(
      `SELECT TRIM(LOWER(question)) AS question, COUNT(*) AS count
       FROM queries
       GROUP BY TRIM(LOWER(question))
       ORDER BY count DESC LIMIT ?`,
    )
    .all(limit);
}
