import type { Lang } from '../i18n';

export interface FAQItem {
  q: string;
  a: string;
}

export const fallbackFaq: Record<Lang, FAQItem[]> = {
  es: [
    {
      q: '¿Quién es Roberto?',
      a: 'Roberto Rodríguez es un desarrollador con foco en frontend e ingeniería de producto. Edita esta entrada en `web/src/data/fallback-faq.ts` para personalizarla.',
    },
    {
      q: '¿Cómo le contacto?',
      a: 'Escribe a roberto.rgz.fdz@gmail.com.',
    },
  ],
  en: [
    {
      q: 'Who is Roberto?',
      a: 'Roberto Rodríguez is a developer focused on frontend and product engineering. Edit this entry in `web/src/data/fallback-faq.ts` to personalize it.',
    },
    {
      q: 'How can I get in touch?',
      a: 'Write to roberto.rgz.fdz@gmail.com.',
    },
  ],
};
