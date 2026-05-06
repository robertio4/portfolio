import OpenAI from 'openai';
import { env } from '../../env.js';
import type { StreamAdapter, StreamArgs } from './types.js';

function getClient(): OpenAI {
  if (!env.OPENROUTER_API_KEY)
    throw new Error('OPENROUTER_API_KEY is not set — cannot use OpenRouter models');
  return new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://robertorgz.dev',
      'X-Title': 'Roberto Rodríguez Portfolio',
    },
  });
}

export const openrouterAdapter: StreamAdapter = {
  async *stream({ providerModelId, contents, systemInstruction, maxTokens, temperature, signal }: StreamArgs) {
    const client = getClient();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemInstruction },
      ...contents.map((c) => ({
        role: c.role as 'user' | 'assistant',
        content: c.text,
      })),
    ];
    const stream = await client.chat.completions.create(
      {
        model: providerModelId,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      },
      { signal },
    );
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) yield delta;
    }
  },
};
