import type { StatsResponse } from '../../lib/adminApi';
import { formatPct } from '../../lib/format';

interface Props {
  stats: StatsResponse | null;
  loading: boolean;
}

export function StatsCards({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="admin-cards">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="admin-card admin-card--skeleton" aria-hidden />
        ))}
      </div>
    );
  }
  return (
    <div className="admin-cards">
      <Card label="Queries" value={String(stats.totalQueries)} />
      <Card label="Unique visitors" value={String(stats.uniqueVisitors)} />
      <Card label="Cache hit" value={formatPct(stats.cacheHitRate)} />
      <Card
        label="Languages"
        value={stats.languages
          .map((l) => `${l.lang?.toUpperCase() ?? '—'} ${l.c}`)
          .join(' · ') || '—'}
      />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-card">
      <span className="admin-card__label">{label}</span>
      <span className="admin-card__value">{value}</span>
    </div>
  );
}
