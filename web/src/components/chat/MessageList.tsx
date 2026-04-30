import { memo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../../hooks/useChatStream';
import { useI18n } from '../../i18n';

import './MessageList.css';

interface Props {
  messages: Message[];
  streaming: boolean;
}

const HINT_ELLIPSIS = <p className="messages__hint">…</p>;

interface BubbleProps {
  message: Message;
  showCaret: boolean;
  streaming: boolean;
  speakerLabel: string;
}

const MessageBubble = memo(function MessageBubble({
  message,
  showCaret,
  streaming,
  speakerLabel,
}: BubbleProps) {
  const isUser = message.role === 'user';
  return (
    <li className={`messages__item messages__item--${message.role}`}>
      <header className="messages__speaker">
        <span className="messages__bullet" aria-hidden />
        {speakerLabel}
      </header>
      <div className="messages__body md">
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <>
            {message.content ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : streaming ? (
              HINT_ELLIPSIS
            ) : null}
            {showCaret && <span className="caret" />}
          </>
        )}
      </div>
    </li>
  );
});

export function MessageList({ messages, streaming }: Props) {
  const { t } = useI18n();
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lastId = messages[messages.length - 1]?.id ?? null;
    if (lastId === lastIdRef.current) return;
    lastIdRef.current = lastId;
    if (!lastId) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages]);

  const userLabel = t('speaker.user');
  const assistantLabel = t('speaker.assistant');

  return (
    <ol className="messages" role="log" aria-live="polite" aria-atomic="false">
      {messages.map((m, i) => {
        const isUser = m.role === 'user';
        const isLast = i === messages.length - 1;
        const showCaret = !isUser && streaming && isLast;
        return (
          <MessageBubble
            key={m.id}
            message={m}
            showCaret={showCaret}
            streaming={streaming}
            speakerLabel={isUser ? userLabel : assistantLabel}
          />
        );
      })}
      <div ref={endRef} aria-hidden />
    </ol>
  );
}
