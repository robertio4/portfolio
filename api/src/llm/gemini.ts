import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";

export const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });

export const CHAT_MODEL = "gemini-3.1-flash-lite-preview";
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIM = 768;

export async function embedText(text: string): Promise<number[]> {
  const r = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIM },
  });
  const vec = r.embeddings?.[0]?.values;
  if (!vec) throw new Error("Embedding failed");
  return vec;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const r = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: texts,
    config: { outputDimensionality: EMBED_DIM },
  });
  const vecs = r.embeddings
    ?.map((e) => e.values)
    .filter((v): v is number[] => Array.isArray(v));
  if (!vecs || vecs.length !== texts.length)
    throw new Error("Batch embedding failed");
  return vecs;
}
