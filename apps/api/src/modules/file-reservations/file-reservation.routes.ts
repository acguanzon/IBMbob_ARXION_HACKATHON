import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReserveFilesBodySchema, ReleaseFilesBodySchema } from '@arxion/types';
import {
  reserveFiles,
  releaseFiles,
  listActiveReservations,
} from './file-reservation.service.js';

export async function fileReservationRoutes(app: FastifyInstance): Promise<void> {
  // POST /tasks/:taskId/files/reserve
  app.post('/tasks/:taskId/files/reserve', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = ReserveFilesBodySchema.parse(req.body);
    const result = await reserveFiles(taskId, body);
    const hasConflicts = result.conflicts.length > 0;
    await reply.status(hasConflicts ? 207 : 201).send({ success: true, data: result });
  });

  // POST /tasks/:taskId/files/release
  app.post('/tasks/:taskId/files/release', async (req: FastifyRequest, reply: FastifyReply) => {
    const { taskId } = req.params as { taskId: string };
    const body = ReleaseFilesBodySchema.parse(req.body);
    const result = await releaseFiles(taskId, body);
    await reply.status(200).send({ success: true, data: result });
  });

  // GET /projects/:projectId/files/active
  app.get('/projects/:projectId/files/active', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = req.params as { projectId: string };
    const reservations = await listActiveReservations(projectId);
    await reply.status(200).send({ success: true, data: reservations });
  });
}
