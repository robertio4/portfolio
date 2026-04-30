import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  adminFetch,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  AdminAuthError,
} from '../lib/adminApi';
import type { StatsResponse, TopQueryRow, VisitorRow } from '../lib/adminApi';
import { StatsCards } from '../components/admin/StatsCards';
import { CountryBreakdown } from '../components/admin/CountryBreakdown';
import { VisitorsTable } from '../components/admin/VisitorsTable';
import { VisitorDetail } from '../components/admin/VisitorDetail';
import { QueriesView } from '../components/admin/QueriesView';
import { TopQueries } from '../components/admin/TopQueries';
import { useI18n } from '../i18n';

import './Admin.css';

type Tab = 'overview' | 'visitors' | 'queries' | 'top';
type RangeKey = '24h' | '7d' | '30d';

export function Admin() {
  const [authed, setAuthed] = useState<boolean>(() => Boolean(getAdminToken()));

  if (!authed) {
    return <TokenGate onAuth={() => setAuthed(true)} />;
  }
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

function TokenGate({ onAuth }: { onAuth: () => void }) {
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setAdminToken(token);
    try {
      await adminFetch('/stats?range=24h');
      onAuth();
    } catch (err) {
      if (err instanceof AdminAuthError) setError('Invalid token');
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a href="#main" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      <main id="main" className="admin admin--gate">
        <form className="admin-gate" onSubmit={handleSubmit}>
          <h1 className="admin-gate__title">Admin</h1>
          <p className="admin-gate__hint">Enter the admin token to continue.</p>
          <input
            type="password"
            className="admin-gate__input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
            autoComplete="off"
            placeholder="••••••••"
          />
          {error && <p className="admin-gate__error">{error}</p>}
          <button type="submit" className="admin-gate__submit" disabled={busy || !token}>
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </form>
      </main>
    </>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<RangeKey>('24h');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [visitors, setVisitors] = useState<VisitorRow[]>([]);
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [topRows, setTopRows] = useState<TopQueryRow[]>([]);
  const [topLoading, setTopLoading] = useState(true);
  const [selectedVisitor, setSelectedVisitor] = useState<number | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof AdminAuthError) {
        onLogout();
        return;
      }
      setFatal((err as Error).message);
    },
    [onLogout],
  );

  useEffect(() => {
    setStatsLoading(true);
    adminFetch<StatsResponse>(`/stats?range=${range}`)
      .then(setStats)
      .catch(handleError)
      .finally(() => setStatsLoading(false));
  }, [range, handleError]);

  useEffect(() => {
    if (tab !== 'visitors' && tab !== 'overview') return;
    setVisitorsLoading(true);
    adminFetch<{ visitors: VisitorRow[] }>('/visitors?limit=100')
      .then((res) => setVisitors(res.visitors))
      .catch(handleError)
      .finally(() => setVisitorsLoading(false));
  }, [tab, handleError]);

  useEffect(() => {
    if (tab !== 'top' && tab !== 'overview') return;
    setTopLoading(true);
    adminFetch<{ queries: TopQueryRow[] }>('/top-queries?limit=20')
      .then((res) => setTopRows(res.queries))
      .catch(handleError)
      .finally(() => setTopLoading(false));
  }, [tab, handleError]);

  function logout() {
    clearAdminToken();
    onLogout();
  }

  return (
    <>
      <a href="#main" className="skip-link">
        {t('a11y.skipToContent')}
      </a>
      <main id="main" className="admin">
        <header className="admin__header">
          <div>
            <span className="admin__kicker">Dashboard</span>
            <h1 className="admin__title">Portfolio metrics</h1>
          </div>
          <div className="admin__actions">
            <RangePicker value={range} onChange={setRange} />
            <button className="admin__logout" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        {fatal && <div className="admin__fatal">Error: {fatal}</div>}

        <nav className="admin__tabs" role="tablist">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={tab === 'visitors'} onClick={() => setTab('visitors')}>
            Visitors
          </TabButton>
          <TabButton active={tab === 'queries'} onClick={() => setTab('queries')}>
            Queries
          </TabButton>
          <TabButton active={tab === 'top'} onClick={() => setTab('top')}>
            Top
          </TabButton>
        </nav>

        {tab === 'overview' && (
          <section className="admin__section">
            <StatsCards stats={stats} loading={statsLoading} />
            <div className="admin__grid">
              <div className="admin__panel">
                <h2 className="admin-section__title">Countries</h2>
                <CountryBreakdown countries={stats?.topCountries ?? []} />
              </div>
              <div className="admin__panel">
                <h2 className="admin-section__title">Top questions</h2>
                <TopQueries rows={topRows.slice(0, 8)} loading={topLoading} />
              </div>
            </div>
          </section>
        )}

        {tab === 'visitors' && (
          <section className="admin__section">
            {selectedVisitor ? (
              <VisitorDetail
                visitorId={selectedVisitor}
                onBack={() => setSelectedVisitor(null)}
              />
            ) : (
              <VisitorsTable
                visitors={visitors}
                onSelect={setSelectedVisitor}
                loading={visitorsLoading}
              />
            )}
          </section>
        )}

        {tab === 'queries' && (
          <section className="admin__section">
            <QueriesView
              onVisitor={(id) => {
                setSelectedVisitor(id);
                setTab('visitors');
              }}
            />
          </section>
        )}

        {tab === 'top' && (
          <section className="admin__section">
            <TopQueries rows={topRows} loading={topLoading} />
          </section>
        )}
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className={`admin-tab${active ? ' admin-tab--active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RangePicker({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  const options: RangeKey[] = ['24h', '7d', '30d'];
  return (
    <div className="admin-range" role="group" aria-label="Time range">
      {options.map((o) => (
        <button
          key={o}
          className={`admin-range__btn${value === o ? ' admin-range__btn--active' : ''}`}
          onClick={() => onChange(o)}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
