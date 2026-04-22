import { useEffect, useRef, useState } from 'react';
import { adminFetch, type QueryRow } from '../../lib/adminApi';
import { countryFlag, formatRelative } from '../../lib/format';

interface Props {
  onVisitor: (id: number) => void;
}

export function QueriesView({ onVisitor }: Props) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      adminFetch<{ queries: QueryRow[] }>(`/queries?${params.toString()}`)
        .then((res) => setRows(res.queries))
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div>
      <input
        type="search"
        className="admin-search"
        placeholder="Search question text…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && <p className="admin-empty">Error: {error}</p>}
      {loading ? (
        <p className="admin-empty">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="admin-empty">No matching queries.</p>
      ) : (
        <ol className="admin-timeline">
          {rows.map((q) => (
            <li key={q.id} className="admin-timeline__item">
              <div className="admin-timeline__meta">
                <span className="admin-tag">{q.lang?.toUpperCase() ?? '—'}</span>
                {q.cache_hit === 1 && <span className="admin-tag admin-tag--cache">cache</span>}
                <span className="admin-timeline__ts">{formatRelative(q.ts)} ago</span>
                {q.country && (
                  <span className="admin-timeline__client">
                    <span aria-hidden>{countryFlag(q.country)}</span>
                    {[q.city, q.country].filter(Boolean).join(', ')}
                  </span>
                )}
                <button className="admin-link admin-link--inline" onClick={() => onVisitor(q.visitor_id)}>
                  visitor #{q.visitor_id}
                </button>
              </div>
              <p className="admin-timeline__q">{q.question}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
