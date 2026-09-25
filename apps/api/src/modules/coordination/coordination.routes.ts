import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DeclareWorkIntentBodySchema, DeclareContractBodySchema } from '@arxion/types';
import {
  beginTask,
  declareWorkIntent,
  getWorkIntent,
  declareContract,
  getContracts,
  getContractRisks,
} from './coordination.service.js';

export async function coordinationRoutes(app: FastifyInstance): Promise<void> {
  // POST /coordination/begin
  // Full begin_task preflight: claim + session + context + risks
  app.post('/coordination/begin', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId, userId, agentType, externalAgentId } = req.body as {
      taskId: string;
      userId: string;
      agentType?: 'IBM_BOB' | 'CURSOR' | 'CLAUDE_CODE' | 'OTHER';
      externalAgentId?: string;
    };

    if (!taskId || !userId) {
      await reply.status(400).send({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'taskId and userId are required' },
      });
      return;
    }

    const preflight = await beginTask(taskId, userId, agentType ?? 'IBM_BOB', externalAgentId);
    await reply.status(200).send({ success: true, data: preflight });
  });

  // POST /tasks/:taskId/work-intent
  app.post('/tasks/:taskId/work-intent', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = DeclareWorkIntentBodySchema.parse(req.body);
    const intent = await declareWorkIntent(taskId, body);
    await reply.status(200).send({ success: true, data: intent });
  });

  // GET /tasks/:taskId/work-intent
  app.get('/tasks/:taskId/work-intent', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const intent = await getWorkIntent(taskId);
    await reply.status(200).send({ success: true, data: intent });
  });

  // POST /tasks/:taskId/contracts
  app.post('/tasks/:taskId/contracts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = DeclareContractBodySchema.parse(req.body);
    const contract = await declareContract(taskId, body);
    await reply.status(201).send({ success: true, data: contract });
  });

  // GET /tasks/:taskId/contracts
  app.get('/tasks/:taskId/contracts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const contracts = await getContracts(taskId);
    await reply.status(200).send({ success: true, data: contracts });
  });

  // GET /tasks/:taskId/contract-risks
  app.get('/tasks/:taskId/contract-risks', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const risks = await getContractRisks(taskId);
    await reply.status(200).send({ success: true, data: risks });
  });
}
