import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { resolve, extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pdfParse from 'pdf-parse';
import { embedBatch, EMBED_MODEL } from '../src/llm/gemini.js';
import type { Chunk } from '../src/rag/retrieve.js';
import { splitterFor } from './splitters.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_DIR = resolve(__dirname, '../../doc');
const OUT_PATH = resolve(__dirname, '../src/rag/index.json');

const BATCH = 100;

interface DocFile {
  source: string;
  text: string;
}

function listDocs(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      files.push(...listDocs(full));
    } else if (/\.(pdf|md|txt)$/i.test(name)) {
      files.push(full);
    }
  }
  return files;
}

async function readDoc(path: string): Promise<DocFile> {
  const ext = extname(path).toLowerCase();
  const buf = readFileSync(path);
  if (ext === '.pdf') {
    const r = await pdfParse(buf);
    return { source: path, text: normalize(r.text) };
  }
  return { source: path, text: normalize(buf.toString('utf-8')) };
}

function normalize(t: string): string {
  return t.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

async function main() {
  const files = listDocs(DOC_DIR);
  if (files.length === 0) {
    console.error(`No documents found in ${DOC_DIR}. Add a CV (.pdf/.md/.txt) and re-run.`);
    process.exit(1);
  }
  console.log(`Found ${files.length} document(s):`);
  for (const f of files) console.log(`  - ${f}`);

  const chunks: Chunk[] = [];
  for (const path of files) {
    const ext = extname(path).toLowerCase();
    const doc = await readDoc(path);
    const pieces = splitterFor(ext).split(doc.text);
    console.log(`  ${path}: ${pieces.length} chunk(s)`);
    pieces.forEach((text, idx) => {
      chunks.push({
        id: `${path}#${idx}`,
        source: path.replace(`${DOC_DIR}/`, ''),
        text,
        vector: [],
      });
    });
  }

  console.log(`\nEmbedding ${chunks.length} chunk(s) with ${EMBED_MODEL}…`);
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const vecs = await embedBatch(slice.map((c) => c.text));
    slice.forEach((c, j) => (c.vector = vecs[j]!));
    process.stdout.write(`  ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`);
  }
  console.log('\nDone embedding.');

  const dim = chunks[0]?.vector.length ?? 0;
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify({ model: EMBED_MODEL, dim, chunks }, null, 0));
  const sizeKb = (Buffer.byteLength(JSON.stringify(chunks)) / 1024).toFixed(1);
  console.log(`Wrote ${chunks.length} chunk(s) (${sizeKb} KB) to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
