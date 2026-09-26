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
import { completionReportRoutes } from './modules/completion-reports/completion-report.routes.js';
import { reviewRoutes } from './modules/reviews/review.routes.js';
import { reviewFindingRoutes } from './modules/reviews/review-findings.routes.js';
import { gitRoutes } from './modules/git/git.routes.js';
import { decisionRoutes } from './modules/decisions/decision.routes.js';
// Phase 4
import { repositoryRoutes } from './modules/repositories/repository.routes.js';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { phase4Routes } from './modules/phase4/phase4.routes.js';
// Phase 5
import { phase5Routes } from './modules/phase5/phase5.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { launchRoutes } from './modules/launch/launch.routes.js';
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
  // Phase 3
  await app.register(completionReportRoutes);
  await app.register(reviewRoutes);
  await app.register(reviewFindingRoutes);
  await app.register(gitRoutes);
  await app.register(decisionRoutes);
  // Phase 4
  await app.register(repositoryRoutes);
  await app.register(webhookRoutes);
  await app.register(phase4Routes);
  // Phase 5
  await app.register(phase5Routes);
  // Realignment
  await app.register(authRoutes);
  await app.register(launchRoutes);

  // Attach Socket.IO and start background jobs after server is ready
  app.addHook('onReady', () => {
    attachWebSocket(app, corsOrigin);
    startStalenessWatcher(realtimeEmitter);
  });

  return app;
}
