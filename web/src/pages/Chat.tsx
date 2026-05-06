import { useEffect, useState } from 'react';
import { LanguageToggle } from '../components/LanguageToggle';
import { Composer } from '../components/chat/Composer';
import { MessageList } from '../components/chat/MessageList';
import { SuggestedPrompts } from '../components/chat/SuggestedPrompts';
import { FallbackFaq } from '../components/chat/FallbackFaq';
import { ModelSelector } from '../components/chat/ModelSelector';
import { useChatStream } from '../hooks/useChatStream';
import { useTurnstile } from '../hooks/useTurnstile';
import { useModel } from '../hooks/useModel';
import { useI18n } from '../i18n';
import { fetchModels, type PublicModelEntry } from '../lib/modelsApi';

import './Chat.css';

export function Chat() {
  const { t, lang } = useI18n();
  const { messages, streaming, error, send } = useChatStream();
  const { containerRef, getToken } = useTurnstile();
  const [composerSeed, setComposerSeed] = useState<string | undefined>(undefined);
  const [models, setModels] = useState<PublicModelEntry[]>([]);
  const { modelId, setModelId } = useModel(models);

  useEffect(() => {
    fetchModels()
      .then(setModels)
      .catch(() => {/* use empty list — ModelSelector renders nothing */});
  }, []);

  // Seed composer from `?q=` query param (e.g. when arriving via SearchAction).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q && q.trim() && messages.length === 0) {
      setComposerSeed(q);
      window.history.replaceState(null, '', '/');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasConversation = messages.length > 0;
  const capBlocked = error?.kind === 'cap';

  async function handleSend(text: string) {
    try {
      const token = await getToken();
      send({ text, lang, turnstileToken: token, model: modelId });
      setComposerSeed('');
    } catch {
      // surface as generic — user can retry
      console.warn('turnstile token unavailable');
    }
  }

  function handlePick(text: string) {
    setComposerSeed(text);
  }

  function renderError() {
    if (!error) return null;
    if (error.kind === 'model_rate') {
      return (
        <div className="chat__error rise" role="alert">
          <span>{t('errors.model_rate')}</span>
          {error.retryWith.length > 0 && (
            <span className="chat__error-retry">
              {' '}{t('errors.model_rate_try')}{' '}
              {error.retryWith.map((id) => {
                const m = models.find((x) => x.id === id);
                return (
                  <button
                    key={id}
                    className="chat__error-chip"
                    onClick={() => setModelId(id)}
                    type="button"
                  >
                    {m?.label ?? id}
                  </button>
                );
              })}
            </span>
          )}
        </div>
      );
    }
    const key = error.kind === 'rate'
      ? 'errors.rate'
      : error.kind === 'cap'
      ? 'errors.cap'
      : error.kind === 'turnstile'
      ? 'errors.turnstile'
      : 'errors.generic';
    return (
      <div className="chat__error rise" role="alert">
        {t(key)}
      </div>
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      <main id="main" className="chat">
        <header className="chat__header rise rise-1">
          <span className="chat__mark" aria-hidden>
            {/* Monogram */}
            RR
          </span>
          <div className="chat__controls">
            <ModelSelector models={models} selectedId={modelId} onChange={setModelId} />
            <LanguageToggle />
          </div>
        </header>

        <div className="chat__column">
          {!hasConversation && (
            <section className="intro rise">
              <span className="intro__kicker">{t('intro.kicker')}</span>
              <h1 className="intro__name">{t('intro.name')}</h1>
              <p className="intro__lede rise rise-2">{t('intro.lede')}</p>
              <a
                href="/cv.pdf"
                download="Roberto_Rodriguez_CV.pdf"
                className="cv-download rise rise-3"
                aria-label={t('cv.download')}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <path d="M6.5 1v7M3.5 5.5l3 3 3-3M2 11h9" stroke="currentColor"
                        strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t('cv.download')}
              </a>
            </section>
          )}

          {hasConversation && <MessageList messages={messages} streaming={streaming} />}

          {renderError()}

          {capBlocked && <FallbackFaq />}

          <div className="chat__composer rise rise-4">
            <Composer onSend={handleSend} busy={streaming || capBlocked} initialValue={composerSeed} />
            {!hasConversation && !capBlocked && (
              <SuggestedPrompts onPick={handlePick} disabled={streaming} />
            )}
          </div>
        </div>

        <div
          ref={containerRef}
          className="chat__turnstile"
          aria-hidden
          tabIndex={-1}
          {...({ inert: '' } as { inert: string })}
        />

        <footer className="chat__footer">{t('footer.attribution')}</footer>
      </main>
    </>
  );
}
