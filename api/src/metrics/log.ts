import { db } from './db.js';
import type { GeoInfo, UAInfo } from './geo.js';

export interface UpsertVisitorInput {
  ipHash: string;
  geo: GeoInfo;
  now: number;
}

export function upsertVisitor({ ipHash, geo, now }: UpsertVisitorInput): number {
  const existing = db
    .prepare<[string], { id: number }>('SELECT id FROM visitors WHERE ip_hash = ?')
    .get(ipHash);

  if (existing) {
    db.prepare(
      'UPDATE visitors SET last_seen = ?, total_questions = total_questions + 1 WHERE id = ?',
    ).run(now, existing.id);
    return existing.id;
  }

  const result = db
    .prepare(
      `INSERT INTO visitors (ip_hash, country, region, city, isp, first_seen, last_seen, total_questions)
       VALUES (?, ?, ?, ?, NULL, ?, ?, 1)`,
    )
    .run(ipHash, geo.country, geo.region, geo.city, now, now);
  return Number(result.lastInsertRowid);
}

export interface InsertQueryInput {
  ts: number;
  visitorId: number;
  question: string;
  lang: string;
  ua: UAInfo;
  referrer: string | null;
  cacheHit: boolean;
  status: number;
}

export function insertQuery(input: InsertQueryInput): void {
  db.prepare(
    `INSERT INTO queries (ts, visitor_id, question, lang, browser, os, device, referrer, cache_hit, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.ts,
    input.visitorId,
    input.question,
    input.lang,
    input.ua.browser,
    input.ua.os,
    input.ua.device,
    input.referrer,
    input.cacheHit ? 1 : 0,
    input.status,
  );
}

export function todayKey(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function incrementDaily(date: string): number {
  db.prepare(
    `INSERT INTO daily_counter (date, count) VALUES (?, 1)
     ON CONFLICT(date) DO UPDATE SET count = count + 1`,
  ).run(date);
  const row = db
    .prepare<[string], { count: number }>('SELECT count FROM daily_counter WHERE date = ?')
    .get(date);
  return row?.count ?? 0;
}

export function getDaily(date: string): number {
  const row = db
    .prepare<[string], { count: number }>('SELECT count FROM daily_counter WHERE date = ?')
    .get(date);
  return row?.count ?? 0;
}
