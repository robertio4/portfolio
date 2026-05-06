import { useCallback, useState } from 'react';
import type { PublicModelEntry } from '../lib/modelsApi';

const STORAGE_KEY = 'portfolio.model';
const DEFAULT_MODEL_ID = 'gemini-flash-lite';

function readStorage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

export function useModel(availableModels: PublicModelEntry[]) {
  const [modelId, setModelIdState] = useState<string>(readStorage);

  const resolved =
    availableModels.find((m) => m.id === modelId) ??
    availableModels.find((m) => m.isDefault) ??
    availableModels[0];

  const setModelId = useCallback((id: string) => {
    setModelIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage unavailable
    }
  }, []);

  return {
    modelId: resolved?.id ?? DEFAULT_MODEL_ID,
    model: resolved,
    setModelId,
  };
}
