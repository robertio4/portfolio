import { useCallback, useRef, useState } from 'react';
import type { Lang } from '../i18n';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';

export type Role = 'user' | 'assistant';
export interface Message {
  id: string;
  role: Role;
  content: string;
}

export type ChatError = 'rate' | 'cap' | 'turnstile' | 'generic' | null;

interface SendArgs {
  text: string;
  lang: Lang;
  turnstileToken: string;
}

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatError>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ text, lang, turnstileToken }: SendArgs) => {
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '',
      };
      const next = [...messages, userMsg, assistantMsg];
      setMessages(next);
      setError(null);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: next
              .filter((m) => m.id !== assistantMsg.id && m.content.trim().length > 0)
              .map(({ role, content }) => ({ role, content })),
            lang,
            turnstileToken,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          if (res.status === 429) setError('rate');
          else if (res.status === 503) setError('cap');
          else if (res.status === 403) setError('turnstile');
          else setError('generic');
          setMessages((m) => m.filter((x) => x.id !== assistantMsg.id));
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let acc = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split('\n\n');
          buf = events.pop() ?? '';
          for (const ev of events) {
            const dataLine = ev.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const eventLine = ev.split('\n').find((l) => l.startsWith('event:'));
            const eventType = eventLine?.slice(6).trim();
            const payloadStr = dataLine.slice(5).trim();
            try {
              const payload = JSON.parse(payloadStr) as { delta?: string; message?: string };
              if (eventType === 'delta' && payload.delta) {
                acc += payload.delta;
                setMessages((m) =>
                  m.map((x) => (x.id === assistantMsg.id ? { ...x, content: acc } : x)),
                );
              } else if (eventType === 'error') {
                setError('generic');
              }
            } catch {
              // ignore malformed event
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError('generic');
      } finally {
        setMessages((m) => m.filter((x) => !(x.id === assistantMsg.id && x.content.length === 0)));
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, streaming, error, send, stop };
}
