import { cosine } from './retrieve.js';

interface Entry {
  embedding: number[];
  question: string;
  answer: string;
  ts: number;
  lang: string;
}

const MAX_ENTRIES = 100;
const TTL_MS = 24 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.92;

const entries: Entry[] = [];

export function lookup(queryEmb: number[], lang: string): string | null {
  const now = Date.now();
  let best: { idx: number; score: number } | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (now - e.ts > TTL_MS) continue;
    if (e.lang !== lang) continue;
    const score = cosine(queryEmb, e.embedding);
    if (!best || score > best.score) best = { idx: i, score };
  }
  if (best && best.score >= SIMILARITY_THRESHOLD) {
    return entries[best.idx]!.answer;
  }
  return null;
}

export function store(entry: Entry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function clear(): void {
  entries.length = 0;
}

export function size(): number {
  return entries.length;
}
