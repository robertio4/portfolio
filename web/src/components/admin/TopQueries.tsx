import type { TopQueryRow } from '../../lib/adminApi';

interface Props {
  rows: TopQueryRow[];
  loading: boolean;
}

export function TopQueries({ rows, loading }: Props) {
  if (loading) return <p className="admin-empty">Loading…</p>;
  if (!rows.length) return <p className="admin-empty">No queries yet.</p>;
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="admin-bars">
      {rows.map((row, i) => (
        <li key={i} className="admin-bars__row admin-bars__row--wide">
          <span className="admin-bars__label admin-bars__label--wide" title={row.question}>
            {row.question}
          </span>
          <span className="admin-bars__track">
            <span
              className="admin-bars__fill"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </span>
          <span className="admin-bars__count">
            {row.count}
            <span className="admin-bars__pct"> · {((row.count / total) * 100).toFixed(0)}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
