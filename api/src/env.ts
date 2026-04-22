import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  GOOGLE_API_KEY: z.string().min(1),
  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  IP_SALT: z.string().min(8),
  ADMIN_TOKEN: z.string().min(8),
  SQLITE_PATH: z.string().default('./data/metrics.db'),
  RL_PER_MIN: z.coerce.number().int().positive().default(5),
  RL_PER_DAY: z.coerce.number().int().positive().default(30),
  DAILY_CAP: z.coerce.number().int().positive().default(500),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
