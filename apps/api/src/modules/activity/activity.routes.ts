import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getActivityFeed } from './activity.service.js';

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  // GET /projects/:projectId/activity
  app.get('/projects/:projectId/activity', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    const { limit, taskId } = req.query as { limit?: string; taskId?: string };

    const feed = await getActivityFeed(projectId, {
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
      taskId,
    });

    await reply.status(200).send({ success: true, data: feed });
  });

  // GET /tasks/:taskId/activity
  app.get('/tasks/:taskId/activity', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const { limit } = req.query as { limit?: string };

    // Resolve taskId to projectId first
    const { prisma } = await import('@arxion/database');
    const task = await prisma.task.findFirst({
      where: { OR: [{ id: taskId }, { displayId: taskId }] },
      select: { id: true, projectId: true },
    });

    if (!task) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: `Task not found: ${taskId}` },
      });
      return;
    }

    const feed = await getActivityFeed(task.projectId, {
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 50,
      taskId: task.id,
    });

    await reply.status(200).send({ success: true, data: feed });
  });
}
