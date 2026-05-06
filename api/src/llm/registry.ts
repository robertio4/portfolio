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
    providerModelId: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    description: {
      en: 'Balanced Gemini model with generous daily quota.',
      es: 'Modelo Gemini equilibrado con cuota diaria generosa.',
    },
    limits: { rpm: 15, rpd: 1500 },
  },
  {
    id: 'gemini-flash-8b',
    provider: 'gemini',
    providerModelId: 'gemini-1.5-flash-8b',
    label: 'Gemini 1.5 Flash 8B',
    description: {
      en: 'Smallest Gemini model. High throughput.',
      es: 'Modelo Gemini más pequeño. Alta capacidad.',
    },
    limits: { rpm: 30, rpd: 1500 },
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
    id: 'gemma2-9b',
    provider: 'groq',
    providerModelId: 'gemma2-9b-it',
    label: 'Gemma 2 9B',
    description: {
      en: "Google's Gemma 2 accelerated by Groq.",
      es: 'Gemma 2 de Google acelerado por Groq.',
    },
    limits: { rpm: 30, rpd: 14400 },
  },
  {
    id: 'qwen-qwq-32b',
    provider: 'groq',
    providerModelId: 'qwen-qwq-32b',
    label: 'Qwen QwQ 32B',
    description: {
      en: 'Reasoning-focused 32B model. Deliberate but thorough.',
      es: 'Modelo de razonamiento 32B. Reflexivo pero minucioso.',
    },
    limits: { rpm: 6, rpd: 1000 },
  },
  {
    id: 'mistral-7b',
    provider: 'openrouter',
    providerModelId: 'mistralai/mistral-7b-instruct:free',
    label: 'Mistral 7B',
    description: {
      en: 'Efficient Mistral model via OpenRouter free tier.',
      es: 'Modelo Mistral eficiente vía capa gratuita de OpenRouter.',
    },
    limits: { rpm: 20, rpd: 200 },
  },
  {
    id: 'phi-3-mini',
    provider: 'openrouter',
    providerModelId: 'microsoft/phi-3-mini-128k-instruct:free',
    label: 'Phi-3 Mini 128K',
    description: {
      en: "Microsoft's compact model with a 128K context window.",
      es: 'Modelo compacto de Microsoft con ventana de 128K.',
    },
    limits: { rpm: 20, rpd: 200 },
  },
  {
    id: 'qwen-2.5-7b',
    provider: 'openrouter',
    providerModelId: 'qwen/qwen-2.5-7b-instruct:free',
    label: 'Qwen 2.5 7B',
    description: {
      en: "Alibaba's Qwen 2.5 model via OpenRouter.",
      es: 'Modelo Qwen 2.5 de Alibaba vía OpenRouter.',
    },
    limits: { rpm: 20, rpd: 200 },
  },
];

export const DEFAULT_MODEL = MODEL_REGISTRY.find((m) => m.isDefault)!;

export function findModel(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export type PublicModelEntry = Omit<ModelEntry, 'providerModelId'>;

export function toPublic(m: ModelEntry): PublicModelEntry {
  const { providerModelId: _, ...rest } = m;
  return rest;
}
