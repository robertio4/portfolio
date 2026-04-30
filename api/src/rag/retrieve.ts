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

// Below this similarity, the corpus has no meaningful match for the query and
// passing top-k anyway only encourages the LLM to hallucinate. Empty context
// + the system prompt's "if not in context, say so" rule produces a cleaner
// "I don't know" response.
const MIN_SCORE = 0.5;

export function retrieve(queryVec: number[], k = 5): Retrieved[] {
  if (!indexLoaded) loadIndex();
  if (chunks.length === 0) return [];
  const scored = chunks.map((chunk) => ({ chunk, score: cosine(queryVec, chunk.vector) }));
  scored.sort((a, b) => b.score - a.score);
  if ((scored[0]?.score ?? 0) < MIN_SCORE) return [];
  return scored.slice(0, k).filter((r) => r.score >= MIN_SCORE);
}

export function isIndexLoaded(): boolean {
  return indexLoaded;
}

export function indexSize(): number {
  return chunks.length;
}

export function getChunks(): ReadonlyArray<Chunk> {
  if (!indexLoaded) loadIndex();
  return chunks;
}

export { cosine };
