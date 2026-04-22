import { fallbackFaq } from '../../data/fallback-faq';
import { useI18n } from '../../i18n';

import './FallbackFaq.css';

export function FallbackFaq() {
  const { t, lang } = useI18n();
  return (
    <section className="faq rise rise-2">
      <h2 className="faq__title">{t('fallback.title')}</h2>
      <dl className="faq__list">
        {fallbackFaq[lang].map((item, i) => (
          <div key={i} className="faq__row">
            <dt className="faq__q">{item.q}</dt>
            <dd className="faq__a">{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
