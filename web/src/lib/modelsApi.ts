const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';

export interface PublicModelEntry {
  id: string;
  provider: 'gemini' | 'groq' | 'openrouter';
  label: string;
  description: { en: string; es: string };
  limits: { rpm: number; rpd: number };
  isDefault?: boolean;
}

export async function fetchModels(): Promise<PublicModelEntry[]> {
  const res = await fetch(`${API_URL}/chat/models`);
  if (!res.ok) throw new Error('models_fetch_failed');
  return res.json() as Promise<PublicModelEntry[]>;
}
