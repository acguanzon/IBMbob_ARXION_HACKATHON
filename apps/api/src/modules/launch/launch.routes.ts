/**
 * Launch routes
 *
 * POST /projects/:projectId/tasks/:taskId/launch    — create launch request
 * GET  /projects/:projectId/launch-requests         — list pending
 * GET  /launch-requests/:id                         — get single
 * POST /launch-requests/:id/accept                  — ACCEPTED
 * POST /launch-requests/:id/cancel                  — CANCELLED
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateLaunchRequestBodySchema, AcceptLaunchRequestBodySchema } from '@arxion/types';
import {
  createLaunchRequest,
  listPendingLaunchRequests,
  getLaunchRequest,
  acceptLaunchRequest,
  startLaunchRequest,
  cancelLaunchRequest,
} from './launch.service.js';

export async function launchRoutes(app: FastifyInstance): Promise<void> {
  // POST /projects/:projectId/tasks/:taskId/launch
  app.post(
    '/projects/:projectId/tasks/:taskId/launch',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId, taskId } = req.params as { projectId: string; taskId: string };
      const body = CreateLaunchRequestBodySchema.parse(req.body);
      const request = await createLaunchRequest({
        projectId,
        taskId,
        userId: req.user?.id ?? body.userId,
        agentType: body.agentType,
      });
      await reply.status(201).send({ success: true, data: request });
    },
  );

  // GET /projects/:projectId/launch-requests
  app.get(
    '/projects/:projectId/launch-requests',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = req.params as { projectId: string };
      const requests = await listPendingLaunchRequests(projectId);
      await reply.status(200).send({ success: true, data: requests });
    },
  );

  // GET /launch-requests/:id
  app.get('/launch-requests/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const request = await getLaunchRequest(id);
    await reply.status(200).send({ success: true, data: request });
  });

  // POST /launch-requests/:id/accept
  app.post('/launch-requests/:id/accept', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const body = AcceptLaunchRequestBodySchema.parse(req.body ?? {});
    const request = await acceptLaunchRequest(id, body.agentSessionId);
    await reply.status(200).send({ success: true, data: request });
  });

  // POST /launch-requests/:id/start — preflight + create/bind the real agent session
  app.post('/launch-requests/:id/start', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { externalAgentId } = (req.body ?? {}) as { externalAgentId?: string };
    const result = await startLaunchRequest(id, externalAgentId);
    await reply.status(200).send({ success: true, data: result });
  });

  // POST /launch-requests/:id/cancel
  app.post('/launch-requests/:id/cancel', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const request = await cancelLaunchRequest(id);
    await reply.status(200).send({ success: true, data: request });
  });
}
