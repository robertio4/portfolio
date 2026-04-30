import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../env.js';

const dbPath = env.SQLITE_PATH === ':memory:' ? ':memory:' : resolve(env.SQLITE_PATH);
if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL UNIQUE,
      country TEXT,
      region TEXT,
      city TEXT,
      isp TEXT,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      total_questions INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_visitors_last_seen ON visitors(last_seen);
    CREATE INDEX IF NOT EXISTS idx_visitors_country ON visitors(country);

    CREATE TABLE IF NOT EXISTS queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      visitor_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      lang TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      referrer TEXT,
      cache_hit INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL,
      FOREIGN KEY(visitor_id) REFERENCES visitors(id)
    );
    CREATE INDEX IF NOT EXISTS idx_queries_ts ON queries(ts);
    CREATE INDEX IF NOT EXISTS idx_queries_visitor ON queries(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_queries_question ON queries(question);

    CREATE TABLE IF NOT EXISTS daily_counter (
      date TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );
  `);
}
