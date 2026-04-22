import { env } from '../src/env.js';

interface Model {
  name: string;
  displayName: string;
  supportedGenerationMethods?: string[];
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${env.GOOGLE_API_KEY}&pageSize=200`;
const res = await fetch(url);
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const data = (await res.json()) as { models: Model[] };

for (const m of data.models) {
  if (m.supportedGenerationMethods?.includes('generateContent')) {
    console.log(m.name.padEnd(55), '→', m.displayName);
  }
}
