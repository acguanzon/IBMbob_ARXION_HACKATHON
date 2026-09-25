import { buildApp } from './app.js';
import { requireEnv, getEnv } from '@arxion/config';

async function main() {
  // Validate required environment variables at startup
  requireEnv('DATABASE_URL');

  const port = parseInt(getEnv('PORT', '3001'), 10);
  const host = getEnv('HOST', '0.0.0.0');

  const app = await buildApp();

  try {
    await app.listen({ port, host });
    console.info(`🚀 API server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
