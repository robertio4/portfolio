import { useState } from 'react';
import { LanguageToggle } from '../components/LanguageToggle';
import { Composer } from '../components/chat/Composer';
import { MessageList } from '../components/chat/MessageList';
import { SuggestedPrompts } from '../components/chat/SuggestedPrompts';
import { FallbackFaq } from '../components/chat/FallbackFaq';
import { useChatStream } from '../hooks/useChatStream';
import { useTurnstile } from '../hooks/useTurnstile';
import { useI18n } from '../i18n';

import './Chat.css';

export function Chat() {
  const { t, lang } = useI18n();
  const { messages, streaming, error, send } = useChatStream();
  const { containerRef, getToken } = useTurnstile();
  const [composerSeed, setComposerSeed] = useState<string | undefined>(undefined);

  const hasConversation = messages.length > 0;
  const capBlocked = error === 'cap';

  async function handleSend(text: string) {
    try {
      const token = await getToken();
      send({ text, lang, turnstileToken: token });
      setComposerSeed('');
    } catch {
      // surface as generic — user can retry
      console.warn('turnstile token unavailable');
    }
  }

  function handlePick(text: string) {
    setComposerSeed(text);
  }

  return (
    <main className="chat">
      <header className="chat__header rise rise-1">
        <span className="chat__mark" aria-hidden>
          {/* Monogram */}
          RR
        </span>
        <LanguageToggle />
      </header>

      <div className="chat__column">
        {!hasConversation && (
          <section className="intro rise">
            <span className="intro__kicker">{t('intro.kicker')}</span>
            <h1 className="intro__name">{t('intro.name')}</h1>
            <p className="intro__lede rise rise-2">{t('intro.lede')}</p>
          </section>
        )}

        {hasConversation && <MessageList messages={messages} streaming={streaming} />}

        {error && (
          <div className="chat__error rise" role="alert">
            {t(`errors.${error}` as const)}
          </div>
        )}

        {capBlocked && <FallbackFaq />}

        <div className="chat__composer rise rise-4">
          <Composer onSend={handleSend} busy={streaming || capBlocked} initialValue={composerSeed} />
          {!hasConversation && !capBlocked && (
            <SuggestedPrompts onPick={handlePick} disabled={streaming} />
          )}
        </div>
      </div>

      <div ref={containerRef} className="chat__turnstile" aria-hidden />

      <footer className="chat__footer">{t('footer.attribution')}</footer>
    </main>
  );
}
