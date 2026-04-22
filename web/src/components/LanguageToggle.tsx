import { useI18n } from '../i18n';

import './LanguageToggle.css';

export function LanguageToggle() {
  const { lang, toggle } = useI18n();
  return (
    <button className="lang-toggle" onClick={toggle} aria-label="Toggle language">
      <span className={lang === 'es' ? 'is-active' : ''}>ES</span>
      <span className="sep">·</span>
      <span className={lang === 'en' ? 'is-active' : ''}>EN</span>
    </button>
  );
}
