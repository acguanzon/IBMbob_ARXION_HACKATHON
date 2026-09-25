import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateTaskBodySchema, UpdateTaskBodySchema } from '@arxion/types';
import {
  createTask,
  listTasksByProject,
  getTaskById,
  updateTask,
  getTaskDependencies,
} from './task.service.js';
import { requireProject } from '../projects/project.service.js';

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects/:projectId/tasks
  app.post(
    '/projects/:projectId/tasks',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      await requireProject(projectId);

      const body = CreateTaskBodySchema.parse(request.body);
      const { prisma } = await import('@arxion/database');
      const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
      const createdById = user?.id ?? '';

      const task = await createTask(projectId, body, createdById);
      await reply.status(201).send({ success: true, data: task });
    },
  );

  // GET /projects/:projectId/tasks
  app.get(
    '/projects/:projectId/tasks',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      await requireProject(projectId);

      const tasks = await listTasksByProject(projectId);
      await reply.status(200).send({ success: true, data: tasks });
    },
  );

  // GET /tasks/:taskId
  app.get('/tasks/:taskId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    const task = await getTaskById(taskId);
    if (!task) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Task not found: ${taskId}` },
      });
      return;
    }
    await reply.status(200).send({ success: true, data: task });
  });

  // PATCH /tasks/:taskId
  app.patch('/tasks/:taskId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    const body = UpdateTaskBodySchema.parse(request.body);
    const task = await updateTask(taskId, body);
    if (!task) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Task not found: ${taskId}` },
      });
      return;
    }
    await reply.status(200).send({ success: true, data: task });
  });

  // GET /tasks/:taskId/dependencies
  app.get(
    '/tasks/:taskId/dependencies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { taskId } = request.params as { taskId: string };
      const deps = await getTaskDependencies(taskId);
      await reply.status(200).send({ success: true, data: deps });
    },
  );

  // ── Task lifecycle endpoints (Phase 2 stubs) ──────────────────────────────

  // POST /tasks/:taskId/claim
  app.post('/tasks/:taskId/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    // TODO Phase 2: assign task to authenticated user, create activity
    await reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: `claim is available in Phase 2 (task: ${taskId})` },
    });
  });

  // POST /tasks/:taskId/start
  app.post('/tasks/:taskId/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    await reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: `start is available in Phase 2 (task: ${taskId})` },
    });
  });

  // POST /tasks/:taskId/progress
  app.post('/tasks/:taskId/progress', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    await reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: `progress is available in Phase 2 (task: ${taskId})` },
    });
  });

  // POST /tasks/:taskId/request-review
  app.post(
    '/tasks/:taskId/request-review',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { taskId } = request.params as { taskId: string };
      await reply.status(501).send({
        success: false,
        error: { code: 'NOT_IMPLEMENTED', message: `request-review is available in Phase 3 (task: ${taskId})` },
      });
    },
  );

  // POST /tasks/:taskId/complete
  app.post('/tasks/:taskId/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = request.params as { taskId: string };
    await reply.status(501).send({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: `complete is available in Phase 3 (task: ${taskId})` },
    });
  });
}
