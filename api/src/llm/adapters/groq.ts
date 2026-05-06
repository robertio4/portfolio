import Groq from 'groq-sdk';
import { env } from '../../env.js';
import type { StreamAdapter, StreamArgs } from './types.js';

function getClient(): Groq {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set — cannot use Groq models');
  return new Groq({ apiKey: env.GROQ_API_KEY });
}

// Strips <think>...</think> blocks from streaming output (used by reasoning models like Qwen3).
async function* stripThinkingBlocks(source: AsyncIterable<string>): AsyncIterable<string> {
  let inThinking = false;
  let buf = '';

  for await (const chunk of source) {
    buf += chunk;
    while (true) {
      if (!inThinking) {
        const openIdx = buf.indexOf('<think>');
        if (openIdx === -1) {
          // No think tag — yield all but keep last 6 chars in case tag is split across chunks
          const safe = buf.length > 6 ? buf.slice(0, -6) : '';
          if (safe) yield safe;
          buf = buf.slice(safe.length);
          break;
        }
        if (openIdx > 0) yield buf.slice(0, openIdx);
        buf = buf.slice(openIdx + 7);
        inThinking = true;
      } else {
        const closeIdx = buf.indexOf('</think>');
        if (closeIdx === -1) {
          // Discard thinking content, keep possible partial closing tag
          buf = buf.slice(Math.max(0, buf.length - 8));
          break;
        }
        buf = buf.slice(closeIdx + 8);
        inThinking = false;
      }
    }
  }
  if (!inThinking && buf) yield buf;
}

export const groqAdapter: StreamAdapter = {
  async *stream({ providerModelId, contents, systemInstruction, maxTokens, temperature, signal, stripThinking }: StreamArgs) {
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

    async function* rawStream() {
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) yield delta;
      }
    }

    const source = stripThinking ? stripThinkingBlocks(rawStream()) : rawStream();
    for await (const delta of source) yield delta;
  },
};
