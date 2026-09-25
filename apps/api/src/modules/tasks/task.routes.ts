import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateTaskBodySchema,
  UpdateTaskBodySchema,
  ClaimTaskBodySchema,
  ReportProgressBodySchema,
  CompleteTaskBodySchema,
} from '@arxion/types';
import {
  createTask,
  listTasksByProject,
  getTaskById,
  updateTask,
  claimTask,
  releaseTask,
  reportProgress,
  getTaskDependencies,
  getTaskBlockers,
} from './task.service.js';
import { completeTask } from './complete-task.service.js';
import { requireProject } from '../projects/project.service.js';

export async function taskRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects/:projectId/tasks
  app.post('/projects/:projectId/tasks', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    await requireProject(projectId);
    const body = CreateTaskBodySchema.parse(req.body);
    const { prisma } = await import('@arxion/database');
    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    const task = await createTask(projectId, body, user?.id ?? '');
    await reply.status(201).send({ success: true, data: task });
  });

  // GET /projects/:projectId/tasks
  app.get('/projects/:projectId/tasks', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    await requireProject(projectId);
    const tasks = await listTasksByProject(projectId);
    await reply.status(200).send({ success: true, data: tasks });
  });

  // GET /tasks/:taskId
  app.get('/tasks/:taskId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const task = await getTaskById(taskId);
    if (!task) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Task not found: ${taskId}` } });
      return;
    }
    await reply.status(200).send({ success: true, data: task });
  });

  // PATCH /tasks/:taskId
  app.patch('/tasks/:taskId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = UpdateTaskBodySchema.parse(req.body);
    const task = await updateTask(taskId, body);
    if (!task) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Task not found: ${taskId}` } });
      return;
    }
    await reply.status(200).send({ success: true, data: task });
  });

  // POST /tasks/:taskId/claim
  app.post('/tasks/:taskId/claim', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = ClaimTaskBodySchema.parse(req.body);
    const result = await claimTask(taskId, body);
    if ('conflict' in result) {
      await reply.status(409).send({
        success: false,
        error: { code: 'TASK_ALREADY_CLAIMED', message: result.conflict },
      });
      return;
    }
    await reply.status(200).send({ success: true, data: result.task });
  });

  // POST /tasks/:taskId/release
  app.post('/tasks/:taskId/release', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const { userId } = req.body as { userId?: string };
    if (!userId) {
      await reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'userId required' } });
      return;
    }
    const task = await releaseTask(taskId, userId);
    if (!task) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `Task not found: ${taskId}` } });
      return;
    }
    await reply.status(200).send({ success: true, data: task });
  });

  // POST /tasks/:taskId/progress
  app.post('/tasks/:taskId/progress', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = ReportProgressBodySchema.parse(req.body);
    await reportProgress(taskId, body);
    await reply.status(200).send({ success: true, data: { recorded: true } });
  });

  // GET /tasks/:taskId/dependencies
  app.get('/tasks/:taskId/dependencies', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const deps = await getTaskDependencies(taskId);
    await reply.status(200).send({ success: true, data: deps });
  });

  // GET /tasks/:taskId/blockers
  app.get('/tasks/:taskId/blockers', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const blockers = await getTaskBlockers(taskId);
    await reply.status(200).send({ success: true, data: blockers });
  });

  // POST /tasks/:taskId/start — stub (begin_task handles full flow)
  app.post('/tasks/:taskId/start', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    await reply.status(501).send({ success: false, error: { code: 'USE_BEGIN_TASK', message: `Use begin_task MCP tool or POST /tasks/${taskId}/claim then /coordination/begin` } });
  });

  // POST /tasks/:taskId/complete — Phase 3
  app.post('/tasks/:taskId/complete', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = CompleteTaskBodySchema.parse(req.body);
    const result = await completeTask(taskId, body);
    await reply.status(200).send({ success: true, data: result });
  });
}
