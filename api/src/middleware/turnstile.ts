import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../env.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface VerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export interface ChatVariables {
  rawBody: unknown;
}

export const turnstileMiddleware: MiddlewareHandler<{ Variables: ChatVariables }> = async (
  c,
  next,
) => {
  let token: string | undefined;
  let body: unknown;
  try {
    body = await c.req.json<{ turnstileToken?: string }>();
    token = (body as { turnstileToken?: string } | undefined)?.turnstileToken;
    c.set('rawBody', body);
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

export function getClientIp(c: Context): string {
  const cf = c.req.header('cf-connecting-ip');
  if (cf) return cf;
  const xff = c.req.header('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const xri = c.req.header('x-real-ip');
  if (xri) return xri;
  return '127.0.0.1';
}
