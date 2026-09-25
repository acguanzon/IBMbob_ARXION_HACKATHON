import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RegisterGitLinkBodySchema, ConfirmMergeBodySchema } from '@arxion/types';
import { registerGitLink, getMergeReadiness, confirmMerge } from './git.service.js';

export async function gitRoutes(app: FastifyInstance): Promise<void> {
  // POST /tasks/:taskId/git-link
  app.post('/tasks/:taskId/git-link', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = RegisterGitLinkBodySchema.parse(req.body);
    const link = await registerGitLink(taskId, body);
    await reply.status(200).send({ success: true, data: link });
  });

  // GET /tasks/:taskId/merge-readiness
  app.get('/tasks/:taskId/merge-readiness', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const readiness = await getMergeReadiness(taskId);
    await reply.status(200).send({ success: true, data: readiness });
  });

  // POST /tasks/:taskId/confirm-merge
  app.post('/tasks/:taskId/confirm-merge', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = ConfirmMergeBodySchema.parse(req.body);
    const link = await confirmMerge(taskId, body);
    await reply.status(200).send({ success: true, data: link });
  });
}
