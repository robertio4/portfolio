export type Provider = 'gemini' | 'groq' | 'openrouter';
export type ModelId = string;

export interface ModelEntry {
  id: ModelId;
  provider: Provider;
  providerModelId: string;
  label: string;
  description: { en: string; es: string };
  limits: { rpm: number; rpd: number };
  isDefault?: boolean;
  stripThinking?: boolean;
}

export const MODEL_REGISTRY: ModelEntry[] = [
  // ── Groq LPU (fastest inference hardware) ──────────────────────────
  {
    id: 'llama-8b',
    provider: 'groq',
    providerModelId: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B',
    description: {
      en: 'Smallest and fastest model. Ideal for quick questions.',
      es: 'El modelo más pequeño y rápido. Ideal para preguntas rápidas.',
    },
    limits: { rpm: 30, rpd: 14400 },
    isDefault: true,
  },
  {
    id: 'llama-4-scout',
    provider: 'groq',
    providerModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout',
    description: {
      en: "Meta's latest model. Great balance of speed and quality.",
      es: 'El último modelo de Meta. Buen equilibrio entre velocidad y calidad.',
    },
    limits: { rpm: 30, rpd: 1000 },
  },
  {
    id: 'llama-70b',
    provider: 'groq',
    providerModelId: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B',
    description: {
      en: 'Powerful 70B model accelerated by Groq LPU chips.',
      es: 'Modelo 70B potente acelerado por chips LPU de Groq.',
    },
    limits: { rpm: 30, rpd: 1000 },
  },
  // ── Gemini (Google AI) ─────────────────────────────────────────────
  {
    id: 'gemini-flash-lite',
    provider: 'gemini',
    providerModelId: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini Flash Lite',
    description: {
      en: "Google's lightweight Gemini model. Fast and efficient.",
      es: 'Modelo Gemini ligero de Google. Rápido y eficiente.',
    },
    limits: { rpm: 15, rpd: 500 },
  },
  {
    id: 'gemini-flash',
    provider: 'gemini',
    providerModelId: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: {
      en: "Google's newest lightweight Gemini model.",
      es: 'El modelo Gemini ligero más reciente de Google.',
    },
    limits: { rpm: 15, rpd: 500 },
  },
  // ── OpenRouter free (larger models, more variable latency) ─────────
  {
    id: 'gpt-oss-120b',
    provider: 'openrouter',
    providerModelId: 'openai/gpt-oss-120b:free',
    label: 'GPT OSS 120B',
    description: {
      en: "OpenAI's open-source 120B model via OpenRouter.",
      es: 'Modelo open-source 120B de OpenAI vía OpenRouter.',
    },
    limits: { rpm: 20, rpd: 200 },
  },
  {
    id: 'gemma4-31b',
    provider: 'openrouter',
    providerModelId: 'google/gemma-4-31b-it:free',
    label: 'Gemma 4 31B',
    description: {
      en: "Google's Gemma 4 31B via OpenRouter.",
      es: 'Gemma 4 31B de Google vía OpenRouter.',
    },
    limits: { rpm: 20, rpd: 200 },
  },
  {
    id: 'nemotron-120b',
    provider: 'openrouter',
    providerModelId: 'nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Nemotron 120B',
    description: {
      en: "NVIDIA's 120B model via OpenRouter.",
      es: 'Modelo 120B de NVIDIA vía OpenRouter.',
    },
    limits: { rpm: 20, rpd: 200 },
  },
  // ── Groq reasoning (slowest — generates thinking tokens internally) ─
  {
    id: 'qwen3-32b',
    provider: 'groq',
    providerModelId: 'qwen/qwen3-32b',
    label: 'Qwen3 32B',
    description: {
      en: 'Reasoning model from Alibaba. Slower but more thorough.',
      es: 'Modelo de razonamiento de Alibaba. Lento pero muy preciso.',
    },
    limits: { rpm: 30, rpd: 1000 },
    stripThinking: true,
  },
];

export const DEFAULT_MODEL = MODEL_REGISTRY.find((m) => m.isDefault)!;

export function findModel(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export type PublicModelEntry = Omit<ModelEntry, 'providerModelId' | 'stripThinking'>;

export function toPublic(m: ModelEntry): PublicModelEntry {
  const { providerModelId: _, stripThinking: __, ...rest } = m;
  return rest;
}
