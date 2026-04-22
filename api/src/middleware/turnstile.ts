import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface VerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export const turnstileMiddleware: MiddlewareHandler = async (c, next) => {
  let token: string | undefined;
  try {
    const body = await c.req.json<{ turnstileToken?: string }>();
    token = body?.turnstileToken;
    // Re-attach the body so downstream handlers can read it again.
    (c.req as unknown as { _parsedBody?: unknown })._parsedBody = body;
  } catch {
    // Non-JSON body — handler will deal with it.
  }
  if (!token) {
    return c.json({ error: 'turnstile_token_missing' }, 403);
  }

  const ip = getClientIp(c);
  const params = new URLSearchParams();
  params.set('secret', env.TURNSTILE_SECRET_KEY);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);

  const res = await fetch(VERIFY_URL, { method: 'POST', body: params });
  const json = (await res.json()) as VerifyResponse;
  if (!json.success) {
    return c.json({ error: 'turnstile_failed', codes: json['error-codes'] ?? [] }, 403);
  }
  await next();
};

export function getClientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf;
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const xri = c.req.header('x-real-ip');
  if (xri) return xri;
  // Fall back to a deterministic placeholder so dev still works.
  return '127.0.0.1';
}
