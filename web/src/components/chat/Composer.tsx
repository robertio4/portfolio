import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useI18n } from '../../i18n';

import './Composer.css';

interface Props {
  onSend: (text: string) => void;
  busy: boolean;
  initialValue?: string;
}

export function Composer({ onSend, busy, initialValue }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue ?? '');
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialValue !== undefined) setValue(initialValue);
  }, [initialValue]);

  // Auto-grow textarea on value change. Layout effect avoids a flash.
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [value]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setValue('');
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const placeholder = t('composer.placeholder');

  return (
    <form className="composer" onSubmit={submit}>
      <span className="composer__prompt" aria-hidden>›</span>
      <label htmlFor="composer-input" className="composer__label sr-only">
        {placeholder}
      </label>
      <textarea
        id="composer-input"
        ref={taRef}
        className="composer__input"
        placeholder={placeholder}
        value={value}
        rows={1}
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        autoFocus
      />
      <button
        type="submit"
        className="composer__send"
        disabled={busy || !value.trim()}
      >
        {busy ? t('composer.sending') : t('composer.send')}
      </button>
    </form>
  );
}
