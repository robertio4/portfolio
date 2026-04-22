import { useI18n } from '../../i18n';

import './SuggestedPrompts.css';

interface Props {
  onPick: (text: string) => void;
  disabled?: boolean;
}

export function SuggestedPrompts({ onPick, disabled }: Props) {
  const { t } = useI18n();
  const items: Array<keyof typeof keyMap> = ['suggestions.s1', 'suggestions.s2', 'suggestions.s3'];
  const keyMap = {
    'suggestions.s1': 0,
    'suggestions.s2': 1,
    'suggestions.s3': 2,
  } as const;

  return (
    <div className="suggested rise rise-3">
      <span className="suggested__label">{t('suggestions.title')}</span>
      <ul className="suggested__list">
        {items.map((k) => (
          <li key={k}>
            <button
              type="button"
              className="suggested__chip"
              disabled={disabled}
              onClick={() => onPick(t(k))}
            >
              {t(k)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
