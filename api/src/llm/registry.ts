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
  {
    id: 'gemini-flash-lite',
    provider: 'gemini',
    providerModelId: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini Flash Lite',
    description: {
      en: 'Lightweight Gemini model. Fastest responses.',
      es: 'Modelo Gemini ligero. Respuestas más rápidas.',
    },
    limits: { rpm: 15, rpd: 500 },
    isDefault: true,
  },
  {
    id: 'gemini-flash',
    provider: 'gemini',
    providerModelId: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    description: {
      en: "Google's latest lightweight Gemini model.",
      es: 'El último modelo Gemini ligero de Google.',
    },
    limits: { rpm: 15, rpd: 500 },
  },
  {
    id: 'llama-8b',
    provider: 'groq',
    providerModelId: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B',
    description: {
      en: 'Fast Llama model via Groq LPU chips.',
      es: 'Llama rápido en chips LPU de Groq.',
    },
    limits: { rpm: 30, rpd: 14400 },
  },
  {
    id: 'llama-70b',
    provider: 'groq',
    providerModelId: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B',
    description: {
      en: 'Powerful 70B model. Best quality on Groq.',
      es: 'Modelo 70B potente. Mejor calidad en Groq.',
    },
    limits: { rpm: 30, rpd: 1000 },
  },
  {
    id: 'llama-4-scout',
    provider: 'groq',
    providerModelId: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout',
    description: {
      en: "Meta's latest multimodal model. Fast and efficient.",
      es: 'El último modelo multimodal de Meta. Rápido y eficiente.',
    },
    limits: { rpm: 30, rpd: 1000 },
  },
  {
    id: 'qwen3-32b',
    provider: 'groq',
    providerModelId: 'qwen/qwen3-32b',
    label: 'Qwen3 32B',
    description: {
      en: 'Reasoning-capable 32B model from Alibaba.',
      es: 'Modelo 32B con razonamiento de Alibaba.',
    },
    limits: { rpm: 30, rpd: 1000 },
    stripThinking: true,
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
  {
    id: 'gemma4-26b',
    provider: 'openrouter',
    providerModelId: 'google/gemma-4-26b-a4b-it:free',
    label: 'Gemma 4 26B (MoE)',
    description: {
      en: "Google's Gemma 4 mixture-of-experts model via OpenRouter.",
      es: 'Modelo Gemma 4 mezcla de expertos de Google vía OpenRouter.',
    },
    limits: { rpm: 20, rpd: 200 },
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
