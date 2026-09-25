import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DeclareWorkIntentBodySchema, DeclareContractBodySchema } from '@arxion/types';
import {
  declareWorkIntent,
  getWorkIntent,
  declareContract,
  listContracts,
  getCoordinationRisks,
  beginTask,
} from './coordination.service.js';

export async function coordinationRoutes(app: FastifyInstance): Promise<void> {
  // POST /tasks/:taskId/intent — declare work intent
  app.post('/tasks/:taskId/intent', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = DeclareWorkIntentBodySchema.parse(req.body);
    const intent = await declareWorkIntent(taskId, body);
    await reply.status(200).send({ success: true, data: intent });
  });

  // GET /tasks/:taskId/intent — get declared work intent
  app.get('/tasks/:taskId/intent', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const intent = await getWorkIntent(taskId);
    if (!intent) {
      await reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No work intent declared for this task.' },
      });
      return;
    }
    await reply.status(200).send({ success: true, data: intent });
  });

  // POST /tasks/:taskId/contracts — declare a contract
  app.post('/tasks/:taskId/contracts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = DeclareContractBodySchema.parse(req.body);
    const result = await declareContract(taskId, body);
    await reply.status(201).send({ success: true, data: result });
  });

  // GET /tasks/:taskId/contracts — list declared contracts
  app.get('/tasks/:taskId/contracts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const contracts = await listContracts(taskId);
    await reply.status(200).send({ success: true, data: contracts });
  });

  // GET /projects/:projectId/coordination/risks — get all contract risks
  app.get(
    '/projects/:projectId/coordination/risks',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const risks = await getCoordinationRisks(projectId);
      await reply.status(200).send({ success: true, data: risks });
    },
  );

  // POST /coordination/begin — begin_task preflight
  app.post('/coordination/begin', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId, userId, agentType } = req.body as {
      taskId?: string;
      userId?: string;
      agentType?: string;
    };
    if (!taskId || !userId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'taskId and userId are required' },
      });
      return;
    }
    const preflight = await beginTask(taskId, userId, agentType);
    await reply.status(200).send({ success: true, data: preflight });
  });
}
