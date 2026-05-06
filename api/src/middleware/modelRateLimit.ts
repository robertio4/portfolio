import { MODEL_REGISTRY, findModel } from '../llm/registry.js';

interface Bucket {
  count: number;
  resetAt: number;
}

// Per-IP per-model buckets — inner layer
const ipMinute = new Map<string, Bucket>();
const ipDay = new Map<string, Bucket>();

// Per-IP limit mirrors the existing global rateLimitMiddleware defaults
const PER_IP_RPM = 5;
const PER_IP_RPD = 30;

// Global per-model daily counter — outer layer (tracks provider free-tier usage)
const globalDayCount = new Map<string, number>();
let globalResetAt = nextMidnightUTC();

function nextMidnightUTC(): number {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function maybeResetGlobal(): void {
  if (Date.now() >= globalResetAt) {
    globalDayCount.clear();
    globalResetAt = nextMidnightUTC();
  }
}

function hitBucket(
  bucket: Map<string, Bucket>,
  key: string,
  windowMs: number,
  limit: number,
): boolean {
  const now = Date.now();
  const cur = bucket.get(key);
  if (!cur || cur.resetAt < now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  cur.count += 1;
  return cur.count <= limit;
}

export interface ModelRateLimitError {
  error: 'model_rate_limit';
  model: string;
  retryWith: string[];
}

function availableAlternatives(excludeId: string): string[] {
  return MODEL_REGISTRY.filter((m) => {
    if (m.id === excludeId) return false;
    const globalCount = globalDayCount.get(m.id) ?? 0;
    return globalCount < m.limits.rpd;
  }).map((m) => m.id);
}

/**
 * Checks per-model rate limits. Returns an error object if the model is
 * rate-limited, or null if the request can proceed.
 *
 * Call this AFTER the global rateLimitMiddleware has already passed.
 * Increments counters only on success (null return).
 */
export function checkModelRateLimit(
  ip: string,
  modelId: string,
): ModelRateLimitError | null {
  maybeResetGlobal();

  const model = findModel(modelId);
  if (!model) return null; // unknown model — chat route handles the 400

  const minKey = `${ip}\x00${modelId}\x00m`;
  const dayKey = `${ip}\x00${modelId}\x00d`;

  if (!hitBucket(ipMinute, minKey, 60_000, PER_IP_RPM)) {
    return { error: 'model_rate_limit', model: modelId, retryWith: availableAlternatives(modelId) };
  }
  if (!hitBucket(ipDay, dayKey, 86_400_000, PER_IP_RPD)) {
    return { error: 'model_rate_limit', model: modelId, retryWith: availableAlternatives(modelId) };
  }

  const globalCount = globalDayCount.get(modelId) ?? 0;
  if (globalCount >= model.limits.rpd) {
    return { error: 'model_rate_limit', model: modelId, retryWith: availableAlternatives(modelId) };
  }
  globalDayCount.set(modelId, globalCount + 1);

  return null;
}
