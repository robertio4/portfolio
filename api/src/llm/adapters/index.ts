import type { Provider } from '../registry.js';
import type { StreamAdapter } from './types.js';
import { geminiAdapter } from './gemini.js';
import { groqAdapter } from './groq.js';
import { openrouterAdapter } from './openrouter.js';

const adapters: Record<Provider, StreamAdapter> = {
  gemini: geminiAdapter,
  groq: groqAdapter,
  openrouter: openrouterAdapter,
};

export function getAdapter(provider: Provider): StreamAdapter {
  return adapters[provider];
}
