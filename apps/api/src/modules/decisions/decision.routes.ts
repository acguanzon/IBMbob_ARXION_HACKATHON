import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RecordProjectDecisionBodySchema } from '@arxion/types';
import { recordProjectDecision, getProjectDecisions, supersedeDecision } from './decision.service.js';

export async function decisionRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects/:projectId/decisions
  app.post('/projects/:projectId/decisions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    const body = RecordProjectDecisionBodySchema.parse(req.body);
    const decision = await recordProjectDecision(projectId, body);
    await reply.status(201).send({ success: true, data: decision });
  });

  // GET /projects/:projectId/decisions
  app.get('/projects/:projectId/decisions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    const decisions = await getProjectDecisions(projectId);
    await reply.status(200).send({ success: true, data: decisions });
  });

  // POST /decisions/:decisionId/supersede
  app.post('/decisions/:decisionId/supersede', async (req: FastifyRequest, reply: FastifyReply) => {
    const { decisionId } = req.params as { decisionId: string };
    const { supersededById, projectId } = req.body as { supersededById: string; projectId: string };
    if (!supersededById || !projectId) {
      await reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'supersededById and projectId required' } });
      return;
    }
    await supersedeDecision(decisionId, supersededById, projectId);
    await reply.status(200).send({ success: true, data: { superseded: true } });
  });
}
