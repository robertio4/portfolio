import type { VisitorRow } from '../../lib/adminApi';
import { countryFlag, formatRelative } from '../../lib/format';

interface Props {
  visitors: VisitorRow[];
  onSelect: (id: number) => void;
  loading: boolean;
}

export function VisitorsTable({ visitors, onSelect, loading }: Props) {
  if (loading) return <p className="admin-empty">Loading visitors…</p>;
  if (!visitors.length) return <p className="admin-empty">No visitors yet.</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Where</th>
            <th>Client</th>
            <th className="num">Qs</th>
            <th className="num">First</th>
            <th className="num">Last</th>
          </tr>
        </thead>
        <tbody>
          {visitors.map((v) => (
            <tr key={v.id} onClick={() => onSelect(v.id)} tabIndex={0}>
              <td>
                <span className="admin-flag" aria-hidden>
                  {countryFlag(v.country)}
                </span>
                {[v.city, v.region, v.country].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="mono">{v.ip_hash.slice(0, 10)}…</td>
              <td className="num">{v.total_questions}</td>
              <td className="num" title={new Date(v.first_seen).toISOString()}>
                {formatRelative(v.first_seen)}
              </td>
              <td className="num" title={new Date(v.last_seen).toISOString()}>
                {formatRelative(v.last_seen)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
