import { useState } from 'react';
import type { PublicModelEntry } from '../../lib/modelsApi';
import { useI18n } from '../../i18n';
import './ModelSelector.css';

interface Props {
  models: PublicModelEntry[];
  selectedId: string;
  onChange: (id: string) => void;
}

function InfoIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6.5" cy="6.5" r="5.75" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6.5 5.8v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="6.5" cy="3.9" r="0.65" fill="currentColor" />
    </svg>
  );
}

export function ModelSelector({ models, selectedId, onChange }: Props) {
  const { lang } = useI18n();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (models.length === 0) return null;

  const selected = models.find((m) => m.id === selectedId) ?? models[0]!;
  const description = selected.description[lang];

  return (
    <div className="model-selector">
      <span
        className="model-selector__info"
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        role="button"
        tabIndex={0}
        aria-label={lang === 'es' ? `Información: ${selected.label}` : `Info: ${selected.label}`}
        aria-expanded={tooltipVisible}
      >
        <InfoIcon />
        {tooltipVisible && (
          <span className="model-selector__tooltip" role="tooltip">
            <span className="model-selector__tooltip-label">{selected.label}</span>
            <span className="model-selector__tooltip-desc">{description}</span>
            <span className="model-selector__tooltip-limits">
              {selected.limits.rpm} RPM · {selected.limits.rpd} RPD
            </span>
          </span>
        )}
      </span>

      <select
        className="model-selector__select"
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        aria-label={lang === 'es' ? 'Seleccionar modelo' : 'Select model'}
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <span className="model-selector__meta" aria-hidden>
        {selected.limits.rpm} RPM · {selected.limits.rpd} RPD
      </span>
    </div>
  );
}
