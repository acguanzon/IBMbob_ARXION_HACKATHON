import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AddReviewFindingBodySchema, ResolveFindingBodySchema } from '@arxion/types';
import { addFinding, getFindings, resolveFinding } from './review-findings.service.js';

export async function reviewFindingRoutes(app: FastifyInstance): Promise<void> {
  // POST /reviews/:reviewId/findings
  app.post('/reviews/:reviewId/findings', async (req: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = req.params as { reviewId: string };
    const body = AddReviewFindingBodySchema.parse(req.body);
    const finding = await addFinding(reviewId, body);
    await reply.status(201).send({ success: true, data: finding });
  });

  // GET /reviews/:reviewId/findings
  app.get('/reviews/:reviewId/findings', async (req: FastifyRequest, reply: FastifyReply) => {
    const { reviewId } = req.params as { reviewId: string };
    const findings = await getFindings(reviewId);
    await reply.status(200).send({ success: true, data: findings });
  });

  // PATCH /findings/:findingId/resolve
  app.patch('/findings/:findingId/resolve', async (req: FastifyRequest, reply: FastifyReply) => {
    const { findingId } = req.params as { findingId: string };
    const body = ResolveFindingBodySchema.parse(req.body);
    const finding = await resolveFinding(findingId, body);
    await reply.status(200).send({ success: true, data: finding });
  });
}
