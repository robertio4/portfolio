const TOKEN_KEY = 'portfolio.adminToken';
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export class AdminAuthError extends Error {}

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new AdminAuthError('no_token');
  const res = await fetch(`${API_BASE}/admin${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 || res.status === 403) {
    clearAdminToken();
    throw new AdminAuthError('unauthorized');
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface StatsResponse {
  range: '24h' | '7d' | '30d';
  totalQueries: number;
  uniqueVisitors: number;
  cacheHitRate: number;
  languages: { lang: string; c: number }[];
  topCountries: { country: string; c: number }[];
}

export interface VisitorRow {
  id: number;
  ip_hash: string;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  first_seen: number;
  last_seen: number;
  total_questions: number;
}

export interface QueryRow {
  id: number;
  ts: number;
  visitor_id: number;
  question: string;
  lang: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  cache_hit: number;
  status: number;
  country?: string | null;
  city?: string | null;
}

export interface TopQueryRow {
  question: string;
  count: number;
}
