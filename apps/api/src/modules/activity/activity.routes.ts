import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@arxion/database';

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  // GET /projects/:projectId/activity
  app.get(
    '/projects/:projectId/activity',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const { limit } = req.query as { limit?: string };

      const take = Math.min(parseInt(limit ?? '50', 10) || 50, 200);

      const activities = await prisma.taskActivity.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          user: { select: { id: true, name: true, email: true } },
          task: { select: { id: true, displayId: true, title: true } },
        },
      });

      await reply.status(200).send({ success: true, data: activities });
    },
  );
}
