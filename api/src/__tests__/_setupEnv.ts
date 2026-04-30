// Set required environment variables BEFORE any module imports `env.ts`.
// dotenv/config does not overwrite already-set process.env values, so these win.
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? 'test-google-api-key';
process.env.TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY ?? 'test-turnstile-site-key';
process.env.TURNSTILE_SECRET_KEY = 'test-turnstile-secret';
process.env.IP_SALT = 'testsalt12345678';
process.env.ADMIN_TOKEN = 'testtoken1234';
process.env.SQLITE_PATH = ':memory:';
process.env.RL_PER_MIN = process.env.RL_PER_MIN ?? '5';
process.env.RL_PER_DAY = process.env.RL_PER_DAY ?? '30';
process.env.DAILY_CAP = process.env.DAILY_CAP ?? '500';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
