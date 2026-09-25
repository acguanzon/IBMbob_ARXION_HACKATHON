import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateAgentSessionBodySchema } from '@arxion/types';
import {
  createAgentSession,
  heartbeat,
  endSession,
  listActiveSessionsByProject,
  getSession,
} from './agent-session.service.js';

export async function agentSessionRoutes(app: FastifyInstance): Promise<void> {
  // POST /agent-sessions
  app.post('/agent-sessions', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = CreateAgentSessionBodySchema.parse(req.body);
    const session = await createAgentSession(body);
    await reply.status(201).send({ success: true, data: session });
  });

  // POST /agent-sessions/:sessionId/heartbeat
  app.post('/agent-sessions/:sessionId/heartbeat', async (req: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = req.params as { sessionId: string };
    const result = await heartbeat(sessionId);
    await reply.status(200).send({ success: true, data: result });
  });

  // POST /agent-sessions/:sessionId/end
  app.post('/agent-sessions/:sessionId/end', async (req: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = req.params as { sessionId: string };
    const result = await endSession(sessionId);
    await reply.status(200).send({ success: true, data: result });
  });

  // GET /agent-sessions/:sessionId
  app.get('/agent-sessions/:sessionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await getSession(sessionId);
    if (!session) {
      await reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }
    await reply.status(200).send({ success: true, data: session });
  });

  // PATCH /agent-sessions/:sessionId
  app.patch('/agent-sessions/:sessionId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { sessionId } = req.params as { sessionId: string };
    const { status } = req.body as { status?: string };
    if (!status) {
      await reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'status required' } });
      return;
    }
    const { prisma } = await import('@arxion/database');
    const session = await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: status as 'IDLE' | 'WORKING' | 'WAITING' | 'FINISHED' | 'STALE' },
      include: { user: true, task: true },
    });
    await reply.status(200).send({ success: true, data: session });
  });

  // GET /projects/:projectId/agent-sessions
  app.get('/projects/:projectId/agent-sessions', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    const sessions = await listActiveSessionsByProject(projectId);
    await reply.status(200).send({ success: true, data: sessions });
  });
}
