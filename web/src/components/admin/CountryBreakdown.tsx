import type { StatsResponse } from '../../lib/adminApi';
import { countryFlag } from '../../lib/format';

interface Props {
  countries: StatsResponse['topCountries'];
}

export function CountryBreakdown({ countries }: Props) {
  if (!countries.length) {
    return <p className="admin-empty">No country data yet.</p>;
  }
  const max = Math.max(...countries.map((c) => c.c));
  return (
    <ul className="admin-bars">
      {countries.map((row) => (
        <li key={row.country} className="admin-bars__row">
          <span className="admin-bars__label">
            <span className="admin-bars__flag" aria-hidden>
              {countryFlag(row.country)}
            </span>
            {row.country}
          </span>
          <span className="admin-bars__track">
            <span
              className="admin-bars__fill"
              style={{ width: `${(row.c / max) * 100}%` }}
            />
          </span>
          <span className="admin-bars__count">{row.c}</span>
        </li>
      ))}
    </ul>
  );
}
