import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '@arxion/config';
import { healthRoutes } from './modules/health/health.routes.js';
import { projectRoutes } from './modules/projects/project.routes.js';
import { taskRoutes } from './modules/tasks/task.routes.js';
import { errorHandler } from './lib/error-handler.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: getEnv('LOG_LEVEL', 'info'),
    },
  });

  // ── Plugins ──────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  // ── Error handler ─────────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler);

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(projectRoutes, { prefix: '/projects' });
  await app.register(taskRoutes);

  return app;
}
