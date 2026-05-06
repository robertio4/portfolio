import Groq from 'groq-sdk';
import { env } from '../../env.js';
import type { StreamAdapter, StreamArgs } from './types.js';

function getClient(): Groq {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set — cannot use Groq models');
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

export const groqAdapter: StreamAdapter = {
  async *stream({ providerModelId, contents, systemInstruction, maxTokens, temperature, signal }: StreamArgs) {
    const client = getClient();
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
      ...contents.map((c) => ({
        role: c.role as 'user' | 'assistant',
        content: c.text,
      })),
    ];
    const completion = await client.chat.completions.create(
      {
        model: providerModelId,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      },
      { signal },
    );
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) yield delta;
    }
  },
};
