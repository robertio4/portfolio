import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Chunk {
  id: string;
  source: string;
  text: string;
  vector: number[];
}

interface IndexFile {
  model: string;
  dim: number;
  chunks: Chunk[];
}

let chunks: Chunk[] = [];
let indexLoaded = false;

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = resolve(__dirname, 'index.json');

export function loadIndex(): void {
  if (!existsSync(INDEX_PATH)) {
    console.warn(`[rag] index.json missing at ${INDEX_PATH}. Run "pnpm ingest" to build it.`);
    chunks = [];
    indexLoaded = true;
    return;
  }
  const raw = readFileSync(INDEX_PATH, 'utf-8');
  const data: IndexFile = JSON.parse(raw);
  chunks = data.chunks;
  indexLoaded = true;
  console.log(`[rag] loaded ${chunks.length} chunks (model=${data.model}, dim=${data.dim})`);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface Retrieved {
  chunk: Chunk;
  score: number;
}

export function retrieve(queryVec: number[], k = 5): Retrieved[] {
  if (!indexLoaded) loadIndex();
  if (chunks.length === 0) return [];
  const scored = chunks.map((chunk) => ({ chunk, score: cosine(queryVec, chunk.vector) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export { cosine };
