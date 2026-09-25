import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '@arxion/config';
import { healthRoutes } from './modules/health/health.routes.js';
import { projectRoutes } from './modules/projects/project.routes.js';
import { taskRoutes } from './modules/tasks/task.routes.js';
import { agentSessionRoutes } from './modules/agent-sessions/agent-session.routes.js';
import { fileReservationRoutes } from './modules/file-reservations/file-reservation.routes.js';
import { activityRoutes } from './modules/activity/activity.routes.js';
import { coordinationRoutes } from './modules/coordination/coordination.routes.js';
import { errorHandler } from './lib/error-handler.js';
import { startStalenessWatcher } from './lib/staleness-watcher.js';
import { realtimeEmitter } from './lib/realtime.js';

export async function buildApp() {
  const app = Fastify({
    logger: { level: getEnv('LOG_LEVEL', 'info') },
  });

  await app.register(cors, {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  app.setErrorHandler(errorHandler);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(projectRoutes, { prefix: '/projects' });
  await app.register(taskRoutes);
  await app.register(agentSessionRoutes);
  await app.register(fileReservationRoutes);
  await app.register(activityRoutes);
  await app.register(coordinationRoutes);

  // Start background staleness watcher after server is ready
  app.addHook('onReady', () => {
    startStalenessWatcher(realtimeEmitter);
  });

  return app;
}
