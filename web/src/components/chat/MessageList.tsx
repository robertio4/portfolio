import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../hooks/useChatStream';
import { useI18n } from '../../i18n';

import './MessageList.css';

interface Props {
  messages: Message[];
  streaming: boolean;
}

export function MessageList({ messages, streaming }: Props) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  return (
    <ol className="messages">
      {messages.map((m, i) => {
        const isUser = m.role === 'user';
        const isLast = i === messages.length - 1;
        const showCaret = !isUser && streaming && isLast;
        return (
          <li key={m.id} className={`messages__item messages__item--${m.role}`}>
            <header className="messages__speaker">
              <span className="messages__bullet" aria-hidden />
              {isUser ? t('speaker.user') : t('speaker.assistant')}
            </header>
            <div className="messages__body md">
              {isUser ? (
                <p>{m.content}</p>
              ) : (
                <>
                  {m.content ? (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  ) : streaming ? (
                    <p className="messages__hint">…</p>
                  ) : null}
                  {showCaret && <span className="caret" />}
                </>
              )}
            </div>
          </li>
        );
      })}
      <div ref={endRef} aria-hidden />
    </ol>
  );
}
