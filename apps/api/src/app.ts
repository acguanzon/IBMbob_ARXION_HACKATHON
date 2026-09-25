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
import { attachWebSocket } from './lib/websocket.js';

export async function buildApp() {
  const app = Fastify({
    logger: { level: getEnv('LOG_LEVEL', 'info') },
  });

  const corsOrigin = getEnv('CORS_ORIGIN', 'http://localhost:3000');

  await app.register(cors, {
    origin: corsOrigin,
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

  // Attach Socket.IO and start background jobs after server is ready
  app.addHook('onReady', () => {
    attachWebSocket(app, corsOrigin);
    startStalenessWatcher(realtimeEmitter);
  });

  return app;
}
