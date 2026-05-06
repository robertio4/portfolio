import { ai } from '../gemini.js';
import type { StreamAdapter, StreamArgs } from './types.js';

export const geminiAdapter: StreamAdapter = {
  async *stream({ providerModelId, contents, systemInstruction, maxTokens, temperature }: StreamArgs) {
    const result = await ai.models.generateContentStream({
      model: providerModelId,
      contents: contents.map((c) => ({
        role: c.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: c.text }],
      })),
      config: {
        systemInstruction,
        maxOutputTokens: maxTokens,
        temperature,
      },
    });
    for await (const chunk of result) {
      const delta = chunk.text;
      if (delta) yield delta;
    }
  },
};
