import { useCallback, useRef, useState } from 'react';
import type { Lang } from '../i18n';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';

export type Role = 'user' | 'assistant';
export interface Message {
  id: string;
  role: Role;
  content: string;
}

export type ChatError =
  | { kind: 'rate' }
  | { kind: 'cap' }
  | { kind: 'turnstile' }
  | { kind: 'generic' }
  | { kind: 'model_rate'; model: string; retryWith: string[] }
  | null;

interface SendArgs {
  text: string;
  lang: Lang;
  turnstileToken: string;
  model: string;
}

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<ChatError>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async ({ text, lang, turnstileToken, model }: SendArgs) => {
      const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '',
      };
      let outgoing: Message[] = [];
      setMessages((prev) => {
        const next = [...prev, userMsg, assistantMsg];
        outgoing = next;
        return next;
      });
      setError(null);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: outgoing
              .filter((m) => m.id !== assistantMsg.id && m.content.trim().length > 0)
              .map(({ role, content }) => ({ role, content })),
            lang,
            turnstileToken,
            model,
          }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          if (res.status === 429) {
            const body = await res.json().catch(() => ({})) as {
              error?: string;
              model?: string;
              retryWith?: string[];
            };
            if (body.error === 'model_rate_limit' && body.model) {
              setError({ kind: 'model_rate', model: body.model, retryWith: body.retryWith ?? [] });
            } else {
              setError({ kind: 'rate' });
            }
          } else if (res.status === 503) {
            setError({ kind: 'cap' });
          } else if (res.status === 403) {
            setError({ kind: 'turnstile' });
          } else {
            setError({ kind: 'generic' });
          }
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
                setError({ kind: 'generic' });
              }
            } catch {
              // ignore malformed event
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setError({ kind: 'generic' });
      } finally {
        setMessages((m) => m.filter((x) => !(x.id === assistantMsg.id && x.content.length === 0)));
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, streaming, error, send, stop };
}
