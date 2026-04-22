import { useEffect, useState } from 'react';
import { adminFetch, type QueryRow, type VisitorRow } from '../../lib/adminApi';
import { countryFlag, formatDateTime, formatRelative } from '../../lib/format';

interface Props {
  visitorId: number;
  onBack: () => void;
}

interface Payload {
  visitor: VisitorRow;
  queries: QueryRow[];
}

export function VisitorDetail({ visitorId, onBack }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    adminFetch<Payload>(`/visitors/${visitorId}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [visitorId]);

  if (error) return <p className="admin-empty">Failed to load: {error}</p>;
  if (!data) return <p className="admin-empty">Loading visitor…</p>;
  const { visitor, queries } = data;

  return (
    <div className="admin-detail">
      <button className="admin-link" onClick={onBack}>
        ← Back to visitors
      </button>
      <header className="admin-detail__head">
        <h3 className="admin-detail__title">
          <span aria-hidden>{countryFlag(visitor.country)}</span>
          {[visitor.city, visitor.region, visitor.country].filter(Boolean).join(', ') || 'Unknown'}
        </h3>
        <dl className="admin-detail__meta">
          <div>
            <dt>Hash</dt>
            <dd className="mono">{visitor.ip_hash.slice(0, 16)}…</dd>
          </div>
          <div>
            <dt>ISP</dt>
            <dd>{visitor.isp ?? '—'}</dd>
          </div>
          <div>
            <dt>First seen</dt>
            <dd>{formatDateTime(visitor.first_seen)}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>
              {formatDateTime(visitor.last_seen)} · {formatRelative(visitor.last_seen)} ago
            </dd>
          </div>
          <div>
            <dt>Total questions</dt>
            <dd>{visitor.total_questions}</dd>
          </div>
        </dl>
      </header>

      <h4 className="admin-section__title">Questions</h4>
      {queries.length === 0 ? (
        <p className="admin-empty">No questions recorded.</p>
      ) : (
        <ol className="admin-timeline">
          {queries.map((q) => (
            <li key={q.id} className="admin-timeline__item">
              <div className="admin-timeline__meta">
                <span className="admin-tag">{q.lang?.toUpperCase() ?? '—'}</span>
                {q.cache_hit === 1 && <span className="admin-tag admin-tag--cache">cache</span>}
                <span className="admin-timeline__ts" title={new Date(q.ts).toISOString()}>
                  {formatDateTime(q.ts)}
                </span>
                <span className="admin-timeline__client">
                  {[q.browser, q.os, q.device].filter(Boolean).join(' · ')}
                </span>
              </div>
              <p className="admin-timeline__q">{q.question}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
